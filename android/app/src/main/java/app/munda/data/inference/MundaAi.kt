package app.munda.data.inference

import android.graphics.Bitmap
import android.util.Log
import app.munda.data.Connectivity
import app.munda.data.RemoteSettings
import app.munda.domain.CoreAnswers
import app.munda.domain.Crop
import app.munda.domain.Guides
import app.munda.domain.CropStage
import app.munda.domain.FieldRecord
import app.munda.domain.FollowUpQuestion
import app.munda.domain.InferenceOrigin
import app.munda.domain.LocalModelState
import app.munda.domain.ModelOutputParser
import app.munda.domain.QA
import app.munda.domain.Route
import com.google.firebase.Firebase
import com.google.firebase.ai.DownloadStatus
import com.google.firebase.ai.GenerativeModel
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.InferenceSource
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerateContentResponse
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.Schema
import com.google.firebase.ai.type.content
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout

data class ObservationInput(
    val crop: Crop,
    val plot: String,
    val stage: CropStage,
    val description: String,
    val core: CoreAnswers,
    val followUps: List<QA>,
    val photo: Bitmap?,
) {
    val hasPhoto get() = photo != null
    /** Everything the farmer told us, for retrieval. */
    val retrievalText get() = description + " " + followUps.joinToString(" ") { it.question + " " + it.answer }
}

sealed interface AiOutcome<out T> {
    data class Done<T>(val value: T, val origin: InferenceOrigin, val latencyMs: Long) : AiOutcome<T>
    /** Can't run anywhere right now (offline and no usable local model). Caller saves and queues. */
    data class Deferred(val reason: String) : AiOutcome<Nothing>
    data class Failed(val reason: String) : AiOutcome<Nothing>
}

data class LocalModelInfo(val state: LocalModelState, val downloadProgress: Float? = null)

/**
 * Munda's on-device + cloud intelligence, via Firebase AI Logic hybrid inference.
 *
 * On-device inference is single-turn only, so the "conversation" is two single-turn calls:
 *  1. [followUpQuestions]: given the description, ask up to 2 questions that best separate the
 *     candidate causes retrieved from the crop's [app.munda.domain.SymptomGuide].
 *  2. [buildRecord]: given description + core answers + follow-up answers, produce a
 *     structured [FieldRecord] of possible causes with visible uncertainty.
 *
 * Each uses a PREFER_ON_DEVICE hybrid model (Gemini Nano when present) and an ONLY_IN_CLOUD model
 * for inputs too large for Nano or when the local call fails while online. Every result records
 * the response's actual `inferenceSource`.
 */
class MundaAi(
    private val settings: RemoteSettings,
    private val connectivity: Connectivity,
) {
    private val ai by lazy { Firebase.ai(backend = GenerativeBackend.googleAI()) }

    private fun hybrid(schema: Schema, maxOut: Int) = ai.generativeModel(
        modelName = settings.cloudModel,
        generationConfig = generationConfig { responseMimeType = "application/json"; responseSchema = schema; temperature = 0.2f },
        onDeviceConfig = OnDeviceConfig(mode = InferenceMode.PREFER_ON_DEVICE, maxOutputTokens = maxOut, temperature = 0.2f),
    )

    private fun cloud(schema: Schema) = ai.generativeModel(
        modelName = settings.cloudModel,
        generationConfig = generationConfig { responseMimeType = "application/json"; responseSchema = schema; temperature = 0.2f },
        onDeviceConfig = OnDeviceConfig.IN_CLOUD,
    )

    private val questionsHybrid by lazy { hybrid(Prompts.questionsSchema, maxOut = 160) }
    private val questionsCloud by lazy { cloud(Prompts.questionsSchema) }
    // Record output is the largest on-device generation; 3 causes with short phrases fit ~300 tokens.
    private val recordHybrid by lazy { hybrid(Prompts.recordSchema, maxOut = 320) }
    private val recordCloud by lazy { cloud(Prompts.recordSchema) }

    // ---------- Local model lifecycle ----------

    private val _local = MutableStateFlow(LocalModelInfo(LocalModelState.UNKNOWN))
    val localModel: StateFlow<LocalModelInfo> = _local.asStateFlow()
    private val downloadLock = Mutex()

    suspend fun refreshLocalStatus() {
        val ext = recordHybrid.onDeviceExtension ?: run { _local.value = LocalModelInfo(LocalModelState.UNAVAILABLE); return }
        _local.value = try {
            LocalModelInfo(ext.checkStatus().toState())
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            Log.w(TAG, "checkStatus failed", e)
            LocalModelInfo(LocalModelState.UNAVAILABLE)
        }
    }

    /** Nano isn't fetched lazily during inference: download it while the farmer still has signal. */
    suspend fun ensureLocalModel() = downloadLock.withLock {
        refreshLocalStatus()
        val ext = recordHybrid.onDeviceExtension ?: return@withLock
        when (_local.value.state) {
            LocalModelState.AVAILABLE -> runCatching { ext.warmUp() }
            LocalModelState.DOWNLOADABLE, LocalModelState.DOWNLOADING -> {
                var total = 0L
                ext.download().collect { s ->
                    when (s) {
                        is DownloadStatus.DownloadStarted -> { total = s.bytesToDownload; _local.value = LocalModelInfo(LocalModelState.DOWNLOADING, 0f) }
                        is DownloadStatus.DownloadInProgress -> _local.value = LocalModelInfo(
                            LocalModelState.DOWNLOADING, if (total > 0) (s.totalBytesDownloaded.toFloat() / total).coerceIn(0f, 1f) else null,
                        )
                        is DownloadStatus.DownloadFailed -> { Log.w(TAG, "Nano download failed", s.exception); _local.value = LocalModelInfo(LocalModelState.DOWNLOADABLE) }
                        is DownloadStatus.DownloadCompleted -> { _local.value = LocalModelInfo(LocalModelState.AVAILABLE); runCatching { ext.warmUp() } }
                    }
                }
            }
            else -> Unit
        }
    }

    // ---------- Step 1: follow-up questions ----------

    suspend fun followUpQuestions(input: ObservationInput, route: Route): AiOutcome<List<FollowUpQuestion>> {
        if (!settings.aiFollowUpsEnabled) return AiOutcome.Done(emptyList(), InferenceOrigin.ON_DEVICE, 0)
        val candidates = Guides.forCrop(input.crop).relevant(input.retrievalText, input.core, input.stage, limit = 4)
        return run(questionsHybrid, questionsCloud, Prompts.questions(input, candidates), input.photo, route) { text ->
            ModelOutputParser.parseQuestions(text)
        }
    }

    // ---------- Step 2: field record ----------

    suspend fun buildRecord(input: ObservationInput, route: Route): AiOutcome<FieldRecord> {
        val guide = Guides.forCrop(input.crop)
        val candidates = guide.relevant(input.retrievalText, input.core, input.stage, limit = 5)
        val allowed = candidates.map { it.id }.toSet()
        return run(recordHybrid, recordCloud, Prompts.record(input, candidates), input.photo, route) { text ->
            ModelOutputParser.parseRecord(text, guide, allowed)
        }
    }

    // ---------- Shared routing/execution ----------

    private suspend fun <T> run(
        hybrid: GenerativeModel,
        cloud: GenerativeModel,
        prompt: String,
        photo: Bitmap?,
        route: Route,
        parse: (String?) -> Result<T>,
    ): AiOutcome<T> {
        val started = System.currentTimeMillis()

        suspend fun viaCloud(): AiOutcome<T> =
            attempt { withTimeout(CLOUD_TIMEOUT_MS) { cloud.generateContent(content(prompt, photo)) } }.fold(
                onSuccess = { finish(it, started, parse) },
                onFailure = { e ->
                    Log.w(TAG, "Cloud call failed", e)
                    if (!connectivity.online.value) AiOutcome.Deferred("Lost signal; saved for later")
                    else AiOutcome.Failed(e.message ?: "Cloud model error")
                },
            )

        return when (route) {
            Route.QUEUE_UNTIL_ONLINE -> AiOutcome.Deferred("No signal and no on-device model on this phone")
            Route.CLOUD -> viaCloud()
            Route.ON_DEVICE -> attempt { withTimeout(LOCAL_TIMEOUT_MS) { withBackoff { hybrid.generateContent(content(prompt, photo)) } } }.fold(
                onSuccess = { r ->
                    when (val out = finish(r, started, parse)) {
                        // Small local model produced something unusable: one cloud retry if we can.
                        is AiOutcome.Failed -> if (connectivity.online.value) viaCloud() else out
                        else -> out
                    }
                },
                onFailure = { e ->
                    Log.w(TAG, "Hybrid (prefer on-device) call failed", e)
                    if (connectivity.online.value) viaCloud() else AiOutcome.Deferred("On-device model busy or unavailable; saved for later")
                },
            )
        }
    }

    private fun <T> finish(r: GenerateContentResponse, started: Long, parse: (String?) -> Result<T>): AiOutcome<T> {
        val origin = if (r.inferenceSource == InferenceSource.ON_DEVICE) InferenceOrigin.ON_DEVICE else InferenceOrigin.CLOUD
        return parse(r.text).fold(
            onSuccess = { AiOutcome.Done(it, origin, System.currentTimeMillis() - started) },
            onFailure = { AiOutcome.Failed("Couldn't read the model's answer: ${it.message}") },
        )
    }

    private fun content(prompt: String, photo: Bitmap?) = content {
        if (photo != null) image(photo) // On-device accepts text plus at most one Bitmap.
        text(prompt)
    }

    /** AICore throttles per app (BUSY / battery quota): brief exponential backoff before giving up. */
    private suspend fun withBackoff(block: suspend () -> GenerateContentResponse): GenerateContentResponse {
        var wait = 400L
        repeat(LOCAL_ATTEMPTS - 1) {
            try { return block() } catch (e: Exception) {
                if (e is CancellationException) throw e
                Log.d(TAG, "Local attempt failed, retrying in ${wait}ms: ${e.message}")
                delay(wait); wait *= 2
            }
        }
        return block()
    }

    private inline fun <R> attempt(block: () -> R): Result<R> = try {
        Result.success(block())
    } catch (e: TimeoutCancellationException) {
        Result.failure(e)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        Result.failure(e)
    }

    private fun OnDeviceModelStatus.toState() = when (this) {
        OnDeviceModelStatus.AVAILABLE -> LocalModelState.AVAILABLE
        OnDeviceModelStatus.DOWNLOADING -> LocalModelState.DOWNLOADING
        OnDeviceModelStatus.DOWNLOADABLE -> LocalModelState.DOWNLOADABLE
        else -> LocalModelState.UNAVAILABLE
    }

    private companion object {
        const val TAG = "MundaAi"
        const val LOCAL_ATTEMPTS = 3
        const val LOCAL_TIMEOUT_MS = 45_000L
        const val CLOUD_TIMEOUT_MS = 45_000L
    }
}

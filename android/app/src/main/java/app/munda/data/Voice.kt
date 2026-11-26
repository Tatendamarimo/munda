package app.munda.data

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.speech.tts.TextToSpeech
import android.util.Log
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.FinishReason
import com.google.firebase.ai.type.InlineDataPart
import com.google.firebase.ai.type.ResponseModality
import com.google.firebase.ai.type.SpeechConfig
import com.google.firebase.ai.type.Voice as GeminiVoice
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.Locale

/**
 * Read-aloud, hybrid like the rest of Munda (mirrors web/src/ui/ReadAloud.tsx): online, a natural
 * literal device speech when available; a short Gemini TTS passage is a fallback when online.
 * Generative audio must not summarize the reference. Cloud speech is cached for replay.
 */
class Voice(private val context: Context, private val settings: RemoteSettings, private val connectivity: Connectivity) {
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var track: AudioTrack? = null
    private val cache = LinkedHashMap<String, Pair<ByteArray, Int>>()

    init {
        tts = TextToSpeech(context) { status -> ttsReady = status == TextToSpeech.SUCCESS }
    }

    private val model by lazy {
        Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
            modelName = settings.ttsModel,
            generationConfig = generationConfig {
                responseModalities = listOf(ResponseModality.AUDIO)
                speechConfig = SpeechConfig(GeminiVoice(settings.ttsVoice))
            },
        )
    }

    /** True when the phone has a voice for this language (BCP-47 tag). */
    fun deviceCanSpeak(localeTag: String): Boolean {
        val t = tts ?: return false
        if (!ttsReady) return false
        return t.isLanguageAvailable(Locale.forLanguageTag(localeTag)) >= TextToSpeech.LANG_AVAILABLE
    }

    private var generation = 0

    /** Completes after every passage has played, rather than after only the first starts. */
    suspend fun speak(text: String, localeTag: String, onStarted: () -> Unit = {}, onDone: () -> Unit) {
        stop()
        val id = generation
        try {
            for (chunk in speechChunks(text, 140)) {
                if (id != generation) return
                val useDevice = deviceCanSpeak(localeTag)
                var read = false
                if (useDevice) try {
                    onStarted()
                    speakOnDevice(chunk, localeTag)
                    read = true
                } catch (e: Exception) {
                    if (e is CancellationException && e !is TimeoutCancellationException) throw e
                    Log.w(TAG, "Device voice failed; trying cloud speech", e)
                }
                if (id != generation) return
                if (!read) {
                    check(connectivity.online.value) { "No voice available" }
                    val audio = cloudSpeech(chunk)
                    if (id != generation) return
                    val done = CompletableDeferred<Unit>()
                    play(audio.first, audio.second) { done.complete(Unit) }
                    onStarted()
                    withTimeout((audio.first.size.toLong() * 1000 / (audio.second * 2)) + 10_000) { done.await() }
                    if (id != generation) return
                    track?.runCatching { stop(); release() }
                    track = null
                }
            }
        } finally { if (id == generation) onDone() }
    }

    fun stop() {
        generation++
        track?.runCatching { stop(); release() }
        track = null
        tts?.stop()
    }

    private suspend fun cloudSpeech(text: String): Pair<ByteArray, Int> {
        cache[text]?.let { return it }
        val prompt = "Read this aloud to a farmer, warmly and slowly, like a kind extension officer standing in the field. Read every word exactly as written, including headings, numbers and the final sentence. Do not summarize, skip, translate or add words. Say only the text:\n\n$text"
        suspend fun once(): Pair<ByteArray, Int>? {
            val r = withTimeout(30_000) { model.generateContent(prompt) }
            val candidate = r.candidates.firstOrNull() ?: return null
            check(candidate.finishReason == null || candidate.finishReason == FinishReason.STOP) { "Incomplete speech response: ${candidate.finishReason}" }
            val parts = candidate.content.parts.filterIsInstance<InlineDataPart>().filter { it.mimeType.startsWith("audio/") }
            if (parts.isEmpty()) return null
            fun rate(part: InlineDataPart) = Regex("rate=(\\d+)").find(part.mimeType)?.groupValues?.get(1)?.toInt() ?: 24_000
            val sampleRate = rate(parts.first())
            check(parts.all { rate(it) == sampleRate }) { "Speech sample rates differ" }
            val pcm = java.io.ByteArrayOutputStream().apply { parts.forEach { write(it.inlineData) } }.toByteArray()
            check(pcm.size >= 2) { "Speech response is empty" }
            return pcm to sampleRate
        }
        // The preview voice model now and then answers without audio; one retry fixes it.
        val out = once() ?: once() ?: error("No audio in the response")
        cache[text] = out
        if (cache.size > 12) cache.remove(cache.keys.first())
        return out
    }

    private suspend fun play(pcm: ByteArray, rate: Int, onDone: () -> Unit) = withContext(Dispatchers.IO) {
        val t = AudioTrack.Builder()
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
            .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(pcm.size).build()
        t.write(pcm, 0, pcm.size)
        t.notificationMarkerPosition = pcm.size / 2 - 1
        t.setPlaybackPositionUpdateListener(object : AudioTrack.OnPlaybackPositionUpdateListener {
            override fun onMarkerReached(track: AudioTrack?) = onDone()
            override fun onPeriodicNotification(track: AudioTrack?) = Unit
        })
        track = t
        t.play()
    }

    private suspend fun speakOnDevice(text: String, localeTag: String) {
        val t = tts ?: error("No device voice available")
        check(ttsReady && deviceCanSpeak(localeTag)) { "No device voice for this language" }
        check(t.setLanguage(Locale.forLanguageTag(localeTag)) >= TextToSpeech.LANG_AVAILABLE) { "Voice data unavailable" }
        t.setSpeechRate(0.92f)
        val done = CompletableDeferred<Unit>()
        val utteranceId = "munda-$generation-${System.nanoTime()}"
        t.setOnUtteranceProgressListener(object : android.speech.tts.UtteranceProgressListener() {
            override fun onStart(id: String?) = Unit
            override fun onDone(id: String?) { if (id == utteranceId) done.complete(Unit) }
            @Deprecated("Deprecated in Java") override fun onError(id: String?) { if (id == utteranceId) done.completeExceptionally(IllegalStateException("Device speech failed")) }
        })
        check(t.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId) == TextToSpeech.SUCCESS) { "Device speech did not start" }
        try { withTimeout(30_000) { done.await() } }
        catch (e: TimeoutCancellationException) { throw IllegalStateException("Device voice did not finish the passage", e) }
        finally { if (!done.isCompleted) t.stop() }
    }

    private companion object { const val TAG = "Voice" }
}

/** Keep passages comfortably below Android TTS input and cloud audio-generation limits. */
internal fun speechChunks(text: String, limit: Int = 600): List<String> {
    require(limit > 0)
    val chunks = mutableListOf<String>()
    var rest = text.trim()
    while (rest.length > limit) {
        val end = rest.take(limit + 1).lastIndexOf(' ').takeIf { it > 0 } ?: limit
        chunks += rest.take(end).trim()
        rest = rest.drop(end).trim()
    }
    if (rest.isNotEmpty()) chunks += rest
    return chunks
}

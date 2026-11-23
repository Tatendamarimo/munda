package app.munda.data.inference

import android.util.Log
import app.munda.data.ObservationRepository
import app.munda.data.RemoteSettings
import app.munda.domain.HistoryReview
import app.munda.domain.HistoryRules
import app.munda.domain.Guides
import app.munda.domain.ModelOutputParser
import app.munda.domain.Observation
import com.google.firebase.Firebase
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import java.util.concurrent.TimeUnit

/**
 * Runs when connected. Deliberately cloud-only: it needs the plot's and farm's history from
 * Firestore plus the full guide, far beyond Nano's 4k-token window, and isn't time-critical.
 * Deterministic rules run first; the cloud model adds what rules can't express (revised
 * likelihoods and prioritised next checks).
 */
class HistoryReviewer(
    private val settings: RemoteSettings,
    private val repository: ObservationRepository,
) {
    private val model by lazy {
        Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
            modelName = settings.reviewModel,
            generationConfig = generationConfig {
                responseMimeType = "application/json"
                responseSchema = Prompts.reviewSchema
                temperature = 0.1f
            },
            onDeviceConfig = OnDeviceConfig.IN_CLOUD,
        )
    }

    /** Throws on infrastructure failure so WorkManager retries with backoff. */
    suspend fun review(target: Observation): HistoryReview {
        val since = target.createdAtMillis - TimeUnit.DAYS.toMillis(settings.historyLookbackDays.toLong())
        val plotHistory = repository.historyForPlot(target.orgId, target.plotKey, since)
        val farmHistory = repository.recentOnFarm(target.orgId, since)
        val rules = HistoryRules.evaluate(target, plotHistory, farmHistory, settings.thresholds)
        val history = (plotHistory + farmHistory).filter { it.id != target.id && it.crop == target.crop }.distinctBy { it.id }

        val ai = if (settings.aiReviewEnabled && target.record != null) {
            try {
                val prompt = Prompts.review(target, plotHistory, farmHistory, rules.map { it.kind })
                val response = withTimeout(60_000) { model.generateContent(prompt) }
                ModelOutputParser.parseReview(response.text, history.map { it.id }.toSet(), Guides.forCrop(target.crop))
                    .onFailure { Log.w(TAG, "Unparseable review", it) }
                    .getOrNull()
            } catch (e: TimeoutCancellationException) {
                null
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Rule findings are still valuable; don't lose them because the model call failed.
                Log.w(TAG, "AI review failed; keeping rule findings", e)
                null
            }
        } else null

        return HistoryReview(
            summary = ai?.summary?.ifBlank { null } ?: defaultSummary(history.size, rules.isNotEmpty()),
            patterns = HistoryRules.merge(rules, ai?.patterns.orEmpty()),
            updatedCauses = ai?.updatedCauses.orEmpty(),
            nextChecks = ai?.nextChecks?.ifEmpty { null } ?: target.record?.possibleCauses?.map { it.checkNext }.orEmpty(),
            reviewedAtMillis = System.currentTimeMillis(),
            historyConsidered = history.size,
        )
    }

    private fun defaultSummary(n: Int, found: Boolean) = when {
        n == 0 -> "This is the first record for this plot, so there's no history to compare yet."
        found -> "Compared with $n earlier record(s); see the patterns below."
        else -> "Compared with $n earlier record(s); no clear pattern yet."
    }

    private companion object { const val TAG = "HistoryReviewer" }
}

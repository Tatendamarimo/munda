package app.munda.data.inference

import android.util.Log
import kotlinx.coroutines.CancellationException

/**
 * Cloud Gemini models get overloaded ("high demand", timeouts). One retry on a second, lighter
 * model (Remote Config: cloud_fallback_model) keeps Munda answering. Mirrors web/src/ai/fallback.ts.
 */
suspend fun <T> withFallback(main: String, fallback: String, call: suspend (String) -> T): T {
    try {
        return call(main)
    } catch (e: Exception) {
        if (e is CancellationException && e !is kotlinx.coroutines.TimeoutCancellationException) throw e
        if (fallback.isBlank() || fallback == main) throw e
        runCatching { Log.w("Fallback", "Cloud model $main failed; trying $fallback", e) }
        return try { call(fallback) } catch (e2: Exception) {
            if (e2 is CancellationException && e2 !is kotlinx.coroutines.TimeoutCancellationException) throw e2
            throw e
        }
    }
}

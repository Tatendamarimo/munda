package app.munda.data

import android.util.Log
import app.munda.BuildConfig
import app.munda.R
import app.munda.domain.HistoryThresholds
import com.google.firebase.Firebase
import com.google.firebase.remoteconfig.remoteConfig
import com.google.firebase.remoteconfig.remoteConfigSettings

/**
 * Routing limits, model names and history thresholds live in Remote Config so they can be tuned
 * per region or season (or a bad model rolled back) without an app update. Values come from the
 * last *activated* config, so they're available offline.
 */
class RemoteSettings {
    private val rc = Firebase.remoteConfig

    init {
        rc.setConfigSettingsAsync(remoteConfigSettings {
            minimumFetchIntervalInSeconds = if (BuildConfig.DEBUG) 60 else 3600
        })
        rc.setDefaultsAsync(R.xml.remote_config_defaults)
    }

    fun refresh() {
        rc.fetchAndActivate().addOnFailureListener { Log.w(TAG, "Remote Config fetch failed; using cached/defaults", it) }
    }

    val cloudModel: String get() = rc.getString("cloud_model").ifBlank { DEFAULT_MODEL }
    val reviewModel: String get() = rc.getString("review_model").ifBlank { DEFAULT_MODEL }
    /** Tried once when the main model fails (overloaded, timeout). */
    val cloudFallbackModel: String get() = rc.getString("cloud_fallback_model").ifBlank { "gemini-3.5-flash-lite" }
    /** Read-aloud voice (Gemini text-to-speech), same keys as the web. */
    val ttsModel: String get() = rc.getString("tts_model").ifBlank { "gemini-2.5-flash-preview-tts" }
    val ttsVoice: String get() = rc.getString("tts_voice").ifBlank { "Sulafat" }
    val maxOnDeviceChars: Int get() = rc.getLong("max_on_device_chars").toInt().coerceIn(500, 8_000)
    val historyLookbackDays: Int get() = rc.getLong("history_lookback_days").toInt().coerceIn(7, 730)
    val aiReviewEnabled: Boolean get() = rc.getBoolean("ai_review_enabled")
    val aiFollowUpsEnabled: Boolean get() = rc.getBoolean("ai_followup_questions_enabled")
    val thresholds: HistoryThresholds
        get() = HistoryThresholds(
            recurringThreshold = rc.getLong("recurring_threshold").toInt().coerceIn(1, 10),
            spreadingPlotThreshold = rc.getLong("spreading_plot_threshold").toInt().coerceIn(1, 20),
            spreadingWindowDays = rc.getLong("spreading_window_days").toInt().coerceIn(3, 120),
        )

    private companion object {
        const val TAG = "RemoteSettings"
        const val DEFAULT_MODEL = "gemini-3.7-flash"
    }
}

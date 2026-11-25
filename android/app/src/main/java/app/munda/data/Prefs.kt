package app.munda.data

import android.content.Context
import androidx.core.content.edit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class Extension(val name: String = "", val phone: String = "")

/** The farmer's own settings; mirrors web/src/data/prefs.ts plus language and weather. */
@Serializable
data class Prefs(
    val name: String = "",
    val place: String = "",
    val extension: Extension? = null,
    /** plotKey → planting date (ms). */
    val plantedAt: Map<String, Long> = emptyMap(),
    val lang: String? = null,
    val weatherOn: Boolean = false,
    val setupStep: Int = 0,
    val setupCompletedUids: List<String> = emptyList(),
)

class PrefsStore(context: Context) {
    private val sp = context.getSharedPreferences("prefs", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    private val _state = MutableStateFlow(runCatching { json.decodeFromString<Prefs>(sp.getString(KEY, null) ?: "{}") }.getOrDefault(Prefs()))
    val state: StateFlow<Prefs> = _state.asStateFlow()
    val value get() = _state.value

    fun update(transform: (Prefs) -> Prefs) {
        val next = transform(_state.value)
        _state.value = next
        sp.edit { putString(KEY, json.encodeToString(Prefs.serializer(), next)) }
    }

    private companion object { const val KEY = "prefs" }
}

/** Whole weeks since planting, or null when unknown (web: cropWeeks). */
fun cropWeeks(plantedAt: Long?, now: Long): Int? =
    plantedAt?.takeIf { it <= now }?.let { ((now - it) / (7 * 86_400_000L)).toInt() }

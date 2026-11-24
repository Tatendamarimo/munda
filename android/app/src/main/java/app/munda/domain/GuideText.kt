package app.munda.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

data class LocalizedEntry(val name: String, val signs: String, val checkInField: String)
data class CauseDisplay(val name: String, val check: String, val modelCheck: String?)

/**
 * Guide text in the farmer's language from shared/guides/i18n (the same files the web app
 * uses), field by field, English as fallback. Mirrors web/src/domain/localize.ts.
 */
class GuideText private constructor(private val read: (String) -> String?) {
    @Serializable private data class Entry(val id: String, val name: String? = null, val signs: String? = null, val checkInField: String? = null, val keywords: List<String> = emptyList())
    @Serializable private data class File(val entries: List<Entry> = emptyList())

    private val json = Json { ignoreUnknownKeys = true }
    private val cache = HashMap<String, Map<String, Entry>>()

    private fun translations(crop: String, lang: String): Map<String, Entry> = cache.getOrPut("$crop.$lang") {
        val body = read("$crop.$lang.json") ?: return@getOrPut emptyMap()
        runCatching { json.decodeFromString<File>(body).entries.associateBy { it.id } }.getOrDefault(emptyMap())
    }

    private fun pick(x: String?, fallback: String) = x?.takeIf { it.isNotBlank() } ?: fallback

    fun localized(entry: GuideEntry, lang: String, crop: String = "maize"): LocalizedEntry {
        val t = if (lang == "en") null else translations(crop, lang)[entry.id]
        return LocalizedEntry(pick(t?.name, entry.name), pick(t?.signs, entry.signs), pick(t?.checkInField, entry.checkInField))
    }

    /** Extra retrieval keywords in that language, so a Shona description finds the right entries. */
    fun keywords(lang: String, crop: String = "maize"): Map<String, List<String>> =
        if (lang == "en") emptyMap() else translations(crop, lang).mapValues { it.value.keywords }

    fun causeDisplay(cause: PossibleCause, lang: String, guide: SymptomGuide, crop: String = "maize"): CauseDisplay {
        val entry = guide.get(cause.guideId) ?: return CauseDisplay(cause.name, cause.checkNext, null)
        val loc = localized(entry, lang, crop)
        if (lang == "en") return CauseDisplay(loc.name, cause.checkNext.ifBlank { loc.checkInField }, null)
        return CauseDisplay(loc.name, loc.checkInField, cause.checkNext.ifBlank { null })
    }

    companion object {
        /** [read] returns shared/guides/i18n/<name>, or null when there's no such file. */
        fun load(read: (String) -> String?) = GuideText(read)
    }
}

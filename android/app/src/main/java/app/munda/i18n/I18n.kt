package app.munda.i18n

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.Instant
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.roundToLong

@Serializable
data class LangInfo(val code: String, val native: String, val english: String, val beta: Boolean, val locale: String)

@Serializable
private data class Calendar(
    val days: List<String>,
    val months: List<String>,
    val minutesAgo: String,
    val hourAgo: String,
    val hoursAgo: String,
    val yesterday: String,
    val daysAgo: String,
    val justNow: String,
)

@Serializable
private data class Dict(val strings: Map<String, String>, val calendar: Calendar? = null)

/**
 * The web app's text, read from shared/i18n (exported from web/src/i18n), so both apps say exactly
 * the same thing in all 7 languages. English fills any gap; `{name}` placeholders are filled from
 * vars. Shona and Ndebele get their own day/month names (Java has no calendar for them).
 */
class I18n private constructor(val langs: List<LangInfo>, private val loadDict: (String) -> Dict?) {
    /** Each language is parsed the first time it's used, not all seven at startup. */
    private val cache = java.util.concurrent.ConcurrentHashMap<String, java.util.Optional<Dict>>()
    private val dicts = object {
        operator fun get(lang: String): Dict? = cache.getOrPut(lang) { java.util.Optional.ofNullable(loadDict(lang)) }.orElse(null)
    }


    fun t(lang: String, key: String, vararg vars: Pair<String, Any>): String {
        val raw = dicts[lang]?.strings?.get(key) ?: dicts["en"]?.strings?.get(key) ?: key
        return vars.fold(raw) { s, (k, v) -> s.replace("{$k}", v.toString()) }
    }

    fun info(lang: String): LangInfo = langs.firstOrNull { it.code == lang } ?: langs.first()

    private fun locale(lang: String): Locale = Locale.forLanguageTag(info(lang).locale)
    private fun zoned(ms: Long) = Instant.ofEpochMilli(ms).atZone(ZoneId.systemDefault())

    /** 0 = Sunday, like JavaScript's getDay(). */
    fun weekday(lang: String, day: Int): String {
        val d = ((day % 7) + 7) % 7
        dicts[lang]?.calendar?.let { return it.days[d] }
        return java.time.DayOfWeek.of(if (d == 0) 7 else d).getDisplayName(TextStyle.FULL, locale(lang))
    }

    fun shortDate(lang: String, ms: Long): String {
        val z = zoned(ms)
        dicts[lang]?.calendar?.let { return "${z.dayOfMonth} ${it.months[z.monthValue - 1]}" }
        return "${z.dayOfMonth} ${z.month.getDisplayName(TextStyle.SHORT, locale(lang))}"
    }

    fun formatDate(lang: String, ms: Long): String = "${shortDate(lang, ms)} ${zoned(ms).year}"

    fun relativeTime(lang: String, ms: Long, now: Long): String {
        val min = ((now - ms) / 60_000.0).roundToLong()
        val h = (min / 60.0).roundToLong()
        val d = (h / 24.0).roundToLong()
        val cal = dicts[lang]?.calendar
        if (cal != null) {
            return when {
                min < 1 -> cal.justNow
                min < 60 -> cal.minutesAgo.replace("{n}", "$min")
                h < 24 -> if (h == 1L) cal.hourAgo else cal.hoursAgo.replace("{n}", "$h")
                d == 1L -> cal.yesterday
                d < 7 -> cal.daysAgo.replace("{n}", "$d")
                else -> shortDate(lang, ms)
            }
        }
        // Other languages: short English-style phrases from the shared strings would need plurals;
        // keep it compact and language-neutral.
        return when {
            min < 60 -> "$min min"
            h < 24 -> "$h h"
            d < 7 -> "$d d"
            else -> shortDate(lang, ms)
        }
    }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        /** [read] returns a file from shared/i18n by name (assets on the device, files in tests). */
        fun load(read: (String) -> String): I18n {
            val langs = json.decodeFromString<List<LangInfo>>(read("langs.json"))
            val codes = langs.map { it.code }.toSet()
            return I18n(langs) { code -> if (code in codes) runCatching { json.decodeFromString<Dict>(read("$code.json")) }.getOrNull() else null }
        }
    }
}

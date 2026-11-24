package app.munda.domain

import kotlinx.serialization.json.*
import java.time.LocalDate
import java.time.ZoneOffset

data class Weather(
    val tempC: Int,
    /** ≥ 5 mm today or on one of the next 2 days. */
    val rainSoon: Boolean,
    /** 0 = Sunday, of the first such day. */
    val rainDay: Int?,
    /** Noon UTC of that day, to drop rain that has passed. */
    val rainAt: Long?,
    val at: Long,
    /** The place searched for, when typed rather than located. */
    val where: String? = null,
)

data class Place(val latitude: Double, val longitude: Double, val label: String)

/** Open-Meteo parsing and freshness, mirroring web/src/data/weather.ts. */
object WeatherRules {
    private const val RAIN_MM = 5.0
    private const val SHOW_FOR = 24 * 3_600_000L
    private val json = Json { ignoreUnknownKeys = true }

    private fun JsonElement?.num() = (this as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull
    private fun JsonElement?.text() = (this as? JsonPrimitive)?.takeIf { it.isString }?.content.orEmpty()

    fun parseForecast(body: String, now: Long): Weather? {
        val o = runCatching { json.parseToJsonElement(body) as? JsonObject }.getOrNull() ?: return null
        val temp = (o["current"] as? JsonObject)?.get("temperature_2m").num() ?: return null
        val daily = o["daily"] as? JsonObject ?: return null
        val times = daily["time"] as? JsonArray ?: return null
        val rain = daily["precipitation_sum"] as? JsonArray ?: return null
        if (times.size != rain.size) return null
        for (i in 0 until minOf(3, times.size)) {
            val mm = rain[i].num() ?: continue
            if (mm >= RAIN_MM) {
                val day = runCatching { LocalDate.parse(times[i].text()) }.getOrNull() ?: continue
                val noon = day.atTime(12, 0).toInstant(ZoneOffset.UTC).toEpochMilli()
                return Weather(Math.round(temp).toInt(), true, day.dayOfWeek.value % 7, noon, now)
            }
        }
        return Weather(Math.round(temp).toInt(), false, null, null, now)
    }

    /** A town or village (feature code PPL…) before a mountain of the same name; label names the province. */
    fun parsePlace(body: String): Place? {
        val results = runCatching { (json.parseToJsonElement(body) as? JsonObject)?.get("results") as? JsonArray }.getOrNull() ?: return null
        val all = results.mapNotNull { it as? JsonObject }.filter { it["latitude"].num() != null && it["longitude"].num() != null }
        val best = all.firstOrNull { it["feature_code"].text().startsWith("PPL") } ?: all.firstOrNull() ?: return null
        val label = listOf(best["name"].text(), best["admin1"].text().removeSuffix(" Province"), best["country"].text()).filter { it.isNotEmpty() }.joinToString(", ")
        return Place(best["latitude"].num()!!, best["longitude"].num()!!, label)
    }

    /** Nothing once over a day old; no rain once its day has passed. */
    fun fresh(w: Weather?, now: Long): Weather? {
        if (w == null || now - w.at > SHOW_FOR) return null
        if (w.rainAt != null && now > w.rainAt + 12 * 3_600_000L) return w.copy(rainSoon = false, rainDay = null, rainAt = null)
        return w
    }
}

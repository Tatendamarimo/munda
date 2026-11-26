package app.munda.data

import android.content.Context
import androidx.core.content.edit
import app.munda.domain.Weather
import app.munda.domain.WeatherRules
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Optional rain outlook from Open-Meteo (free, no key), for the area the farmer typed on Me.
 * Mirrors web/src/data/weather.ts: a town is preferred over a mountain of the same name, the
 * matched place is shown, and an area that can't be found is said plainly.
 */
class WeatherRepo(context: Context, private val prefs: PrefsStore, private val connectivity: Connectivity) {
    @Serializable private data class Cached(val tempC: Int, val rainSoon: Boolean, val rainDay: Int?, val rainAt: Long?, val at: Long, val where: String?)

    private val sp = context.getSharedPreferences("weather", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    private val _weather = MutableStateFlow(readCache())
    val weather: StateFlow<Weather?> = _weather.asStateFlow()
    /** The ~5 km square of the farmer's place (web: placeCell), stamped on checks for a group's map. */
    private val _cell = MutableStateFlow(sp.getString(KEY_CELL, null))
    val cell: StateFlow<String?> = _cell.asStateFlow()
    private val _notFound = MutableStateFlow<String?>(null)
    val placeNotFound: StateFlow<String?> = _notFound.asStateFlow()

    suspend fun refresh(force: Boolean = false) = withContext(Dispatchers.IO) {
        val p = prefs.value
        if (!p.weatherOn || !connectivity.online.value) return@withContext
        val cached = _weather.value
        if (!force && cached != null && System.currentTimeMillis() - cached.at < MAX_AGE) return@withContext
        val place = p.place.trim().ifEmpty { return@withContext }
        runCatching {
            val selected = sp.getString("deviceArea", null)?.takeIf { it == place }
            val point = selected?.split(",")?.mapNotNull { it.trim().toDoubleOrNull() }
            val found = if (point?.size == 2) app.munda.domain.Place(point[0], point[1], place) else WeatherRules.parsePlace(get("https://geocoding-api.open-meteo.com/v1/search?count=10&name=" + URLEncoder.encode(place, "UTF-8")))
            _notFound.value = if (found == null) place else null
            if (found == null) { clear(); return@runCatching }
            GroupRepo.coarseCell(found.latitude, found.longitude).let { _cell.value = it; sp.edit { putString(KEY_CELL, it) } }
            val body = get("https://api.open-meteo.com/v1/forecast?latitude=%.2f&longitude=%.2f".format(java.util.Locale.ROOT, found.latitude, found.longitude) +
                "&current=temperature_2m&daily=precipitation_sum&forecast_days=3&timezone=auto")
            WeatherRules.parseForecast(body, System.currentTimeMillis())?.copy(where = found.label)?.let { w ->
                _weather.value = w
                sp.edit { putString(KEY, json.encodeToString(Cached.serializer(), Cached(w.tempC, w.rainSoon, w.rainDay, w.rainAt, w.at, w.where))) }
            }
        } // offline or API down: keep what we had
    }

    fun selectDeviceArea(label: String) {
        _cell.value = label
        sp.edit { putString("deviceArea", label); putString(KEY_CELL, label) }
    }

    fun clear() { _weather.value = null; sp.edit { remove(KEY) } }

    private fun get(url: String): String = (URL(url).openConnection() as HttpURLConnection).run {
        connectTimeout = 10_000; readTimeout = 10_000
        try { inputStream.bufferedReader().readText() } finally { disconnect() }
    }

    private fun readCache(): Weather? = runCatching {
        json.decodeFromString(Cached.serializer(), sp.getString(KEY, null) ?: return null).let { Weather(it.tempC, it.rainSoon, it.rainDay, it.rainAt, it.at, it.where) }
    }.getOrNull()

    private companion object { const val KEY = "forecast"; const val KEY_CELL = "cell"; const val MAX_AGE = 3 * 3_600_000L }
}

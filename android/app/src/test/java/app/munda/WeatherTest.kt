package app.munda

import app.munda.domain.WeatherRules
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Mirrors web/test/weather.test.ts. */
class WeatherTest {
    private val now = 1_795_000_000_000L

    @Test fun `first rainy day in the next 3 days`() {
        val w = WeatherRules.parseForecast("""{"current":{"temperature_2m":21.4},"daily":{"time":["2026-11-24","2026-11-25","2026-11-26"],"precipitation_sum":[0,6.2,1]}}""", now)!!
        assertEquals(21, w.tempC)
        assertEquals(true, w.rainSoon)
        assertEquals(3, w.rainDay) // Wednesday
    }

    @Test fun `dry days and bad data`() {
        assertEquals(false, WeatherRules.parseForecast("""{"current":{"temperature_2m":30},"daily":{"time":["2026-11-24"],"precipitation_sum":[1]}}""", now)!!.rainSoon)
        assertNull(WeatherRules.parseForecast("""{"daily":{}}""", now))
        assertNull(WeatherRules.parseForecast("nope", now))
    }

    @Test fun `place search prefers a town over a mountain and names the province`() {
        val g = WeatherRules.parsePlace("""{"results":[
            {"name":"Wedza","admin1":"Midlands Province","country":"Zimbabwe","latitude":-20.25,"longitude":29.86,"feature_code":"MT"},
            {"name":"Wedza","admin1":"Mashonaland East Province","country":"Zimbabwe","latitude":-18.62,"longitude":31.57,"feature_code":"PPL"}]}""")!!
        assertEquals(-18.62, g.latitude, 1e-9)
        assertEquals("Wedza, Mashonaland East, Zimbabwe", g.label)
        assertNull(WeatherRules.parsePlace("""{}"""))
    }

    @Test fun `stale forecasts are hidden`() {
        val w = WeatherRules.parseForecast("""{"current":{"temperature_2m":20},"daily":{"time":["2026-11-24"],"precipitation_sum":[9]}}""", now)!!
        assertEquals(w, WeatherRules.fresh(w, now + 3_600_000))
        assertNull(WeatherRules.fresh(w, now + 25 * 3_600_000))
    }
}

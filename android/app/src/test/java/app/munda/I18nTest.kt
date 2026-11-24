package app.munda

import app.munda.i18n.I18n
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.ZoneId

/** The same text as the web app, read from shared/i18n (exported from web/src/i18n). */
class I18nTest {
    private val i18n = I18n.load { name -> File("../../shared/i18n/$name").readText() }

    @Test fun `translates with English fallback and variables`() {
        assertEquals("Possible causes", i18n.t("en", "result.title"))
        assertEquals("Zvingangove zvakonzera", i18n.t("sn", "result.title"))
        assertEquals("Compared with 5 guide entries", i18n.t("en", "live.compared", "n" to 5))
        assertEquals("no.such.key", i18n.t("sn", "no.such.key"))
    }

    @Test fun `knows all seven languages`() {
        assertEquals(listOf("en", "sn", "nd", "sw", "fr", "pt", "es"), i18n.langs.map { it.code })
        assertTrue(i18n.langs.first { it.code == "nd" }.beta)
    }

    @Test fun `shona and ndebele dates like the web app`() {
        val nov24 = LocalDate.of(2026, 11, 24).atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        assertEquals("Chitatu", i18n.weekday("sn", 3))
        assertEquals("24 Mbudzi", i18n.shortDate("sn", nov24))
        assertEquals("24 uLwezi", i18n.shortDate("nd", nov24))
        assertEquals("Wednesday", i18n.weekday("en", 3))
        val hour = 3_600_000L
        assertEquals("maawa 5 apfuura", i18n.relativeTime("sn", nov24 - 5 * hour, nov24))
        assertEquals("nezuro", i18n.relativeTime("sn", nov24 - 24 * hour, nov24))
        assertEquals("izolo", i18n.relativeTime("nd", nov24 - 24 * hour, nov24))
    }
}

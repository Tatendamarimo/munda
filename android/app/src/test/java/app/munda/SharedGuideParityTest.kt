package app.munda

import app.munda.domain.MaizeGuide
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * shared/guides/maize.json is the single source of truth the web client loads directly. This
 * test fails if the Android MaizeGuide drifts from it, so both clients always reason from the
 * same agronomy content.
 */
class SharedGuideParityTest {
    private val shared = File("../../shared/guides/maize.json")

    @Test fun `android maize guide matches shared json`() {
        val entries = Json.parseToJsonElement(shared.readText()).jsonObject.getValue("entries").jsonArray
        assertEquals("entry count", entries.size, MaizeGuide.entries.size)
        entries.zip(MaizeGuide.entries).forEach { (j, k) ->
            val o = j.jsonObject
            fun s(key: String) = o.getValue(key).jsonPrimitive.content
            assertEquals("id", s("id"), k.id)
            assertEquals("${k.id}.name", s("name"), k.name)
            assertEquals("${k.id}.category", s("category"), k.category.name)
            assertEquals("${k.id}.keywords", o.getValue("keywords").jsonArray.map { it.jsonPrimitive.content }, k.keywords)
            assertEquals("${k.id}.signs", s("signs"), k.signs)
            assertEquals("${k.id}.distinguish", s("distinguish"), k.distinguish)
            assertEquals("${k.id}.checkInField", s("checkInField"), k.checkInField)
        }
    }
}

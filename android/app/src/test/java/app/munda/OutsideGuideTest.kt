package app.munda

import app.munda.domain.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Mirrors web/test/outside-guide.test.ts: guide first, Gemini allowed beyond it, never a dose. */
class OutsideGuideTest {
    private val guide = Guides.forCrop(Crop.MAIZE)
    private fun cause(id: String, name: String, l: String, sup: List<String>, check: String) =
        """{"guideId":"$id","name":"$name","likelihood":"$l","supporting":[${sup.joinToString { "\"$it\"" }}],"againstOrMissing":[],"checkNext":"$check"}"""
    private fun parse(vararg causes: String): List<PossibleCause> =
        ModelOutputParser.parseRecord("""{"summary":"s","symptoms":[],"possibleCauses":[${causes.joinToString()}],"urgency":"SOON","uncertaintyNote":"u"}""", guide, setOf("nitrogen")).getOrThrow().possibleCauses

    @Test fun `outside the guide is never above Possible`() {
        val c = parse(cause("other", "Hail damage", "HIGH", listOf("a", "b", "c"), "Look for torn leaves")).single()
        assertEquals(null, c.guideId); assertEquals(Likelihood.MEDIUM, c.likelihood)
    }

    @Test fun `only one outside-guide cause`() {
        val out = parse(cause("other", "Hail damage", "MEDIUM", listOf("a"), "x"), cause("other", "Herbicide drift", "MEDIUM", listOf("a"), "y"))
        assertEquals(listOf("Hail damage"), out.filter { it.guideId == null }.map { it.name })
    }

    @Test fun `a real guide problem the shortlist missed counts as the guide entry`() {
        assertEquals("common_rust", parse(cause("common_rust", "Rust", "MEDIUM", listOf("a"), "rub")).single().guideId)
    }

    @Test fun `doses are removed`() {
        assertEquals(guide.get("nitrogen")!!.checkInField, parse(cause("nitrogen", "N", "MEDIUM", listOf("a"), "Apply 50 kg per hectare")).single().checkNext)
        assertEquals(listOf("lower leaves yellow"), parse(cause("nitrogen", "N", "MEDIUM", listOf("lower leaves yellow", "needs 20 ml per litre"), "Compare")).single().supporting)
        assertTrue(parse(cause("other", "Mites", "LOW", listOf("a"), "Spray 2 ml per litre")).single().checkNext.contains("extension officer"))
    }
}

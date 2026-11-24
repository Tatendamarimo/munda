package app.munda

import app.munda.domain.LiveCause
import app.munda.domain.Likelihood
import app.munda.domain.PartialJson
import kotlinx.serialization.json.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Mirrors web/test/partial-json.test.ts. */
class PartialJsonTest {
    private fun p(s: String) = PartialJson.parse(s)
    private fun j(s: String) = Json.parseToJsonElement(s)

    @Test fun complete() = assertEquals(j("""{"a":1,"b":[true,"x"]}"""), p("""{"a":1,"b":[true,"x"]}"""))
    @Test fun nothingYet() { assertNull(p("")); assertNull(p("```json\n")) }
    @Test fun stringBeingWritten() = assertEquals(j("""{"summary":"Yellow leav"}"""), p("""{"summary":"Yellow leav"""))
    @Test fun keyWithoutValue() {
        assertEquals(j("""{"summary":"Done"}"""), p("""{"summary":"Done","symp"""))
        assertEquals(j("""{"summary":"Done"}"""), p("""{"summary":"Done","symptoms":"""))
        assertEquals(j("""{"summary":"Done"}"""), p("""{"summary":"Done","""))
    }
    @Test fun closesContainers() {
        assertEquals(j("""{"possibleCauses":[{"guideId":"nitrogen_deficiency","name":"Nitro"}]}"""),
            p("""{"possibleCauses":[{"guideId":"nitrogen_deficiency","name":"Nitro"""))
        assertEquals(j("""{"list":["a","b"]}"""), p("""{"list":["a","b"""))
    }
    @Test fun unfinishedTokens() {
        assertEquals(j("""{"a":"x"}"""), p("""{"a":"x","n":12"""))
        assertEquals(j("""{"a":"x"}"""), p("""{"a":"x","ok":tr"""))
        assertEquals(j("""{"a":"x","n":12}"""), p("""{"a":"x","n":12,"""))
    }
    @Test fun escapes() {
        assertEquals(j("""{"s":"say \"hi\""}"""), p("""{"s":"say \"hi\""""))
        assertEquals(j("""{"s":"a"}"""), p("""{"s":"a\"""))
        assertEquals(j("""{"s":"a"}"""), p("""{"s":"a\u00"""))
        assertEquals(j("""{"s":"{not [structure"}"""), p("""{"s":"{not [structure""""))
    }
    @Test fun fence() = assertEquals(j("""{"summary":"ok"}"""), p("```json\n{\"summary\":\"ok\""))

    @Test fun preview() {
        val pv = PartialJson.preview("""{"summary":"Lower leaves yellow","symptoms":["yellow"],"possibleCauses":[{"guideId":"nitrogen_deficiency","name":"Nitrogen deficiency","likelihood":"HIGH","supporting":["a","b"]},{"guideId":"wat""")
        assertEquals("Lower leaves yellow", pv.summary)
        assertEquals(listOf(
            LiveCause("nitrogen_deficiency", "Nitrogen deficiency", Likelihood.HIGH, listOf("a", "b"), emptyList()),
            LiveCause("wat", null, null, emptyList(), emptyList()),
        ), pv.causes)
        assertNull(PartialJson.preview("""{"summ""").summary)
        assertEquals(null, PartialJson.preview("""{"possibleCauses":[{"name":"X","likelihood":"MED""").causes[0].likelihood)
    }
}

package app.munda

import app.munda.domain.Likelihood
import app.munda.domain.MaizeGuide
import app.munda.domain.ModelOutputParser
import app.munda.domain.Urgency
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelOutputParserTest {
    private val guide = setOf("nitrogen", "waterlogging", "sulfur")

    @Test fun `parses fenced record and enforces one Likely cause`() {
        val raw = """
            ```json
            {"summary":"Lower leaves yellowing in patches after heavy rain","symptoms":["yellow lower leaves","stunting"],
             "possibleCauses":[
               {"guideId":"nitrogen","name":"Nitrogen deficiency","likelihood":"HIGH","supporting":["lower leaves first","V-shaped yellowing"],"againstOrMissing":["no fertilizer record"],"checkNext":"Compare with a fertilized row"},
               {"guideId":"waterlogging","name":"Waterlogging","likelihood":"HIGH","supporting":["heavy rain","patches"],"againstOrMissing":[],"checkNext":"Check roots"}
             ],"urgency":"soon","uncertaintyNote":""}
            ```
        """.trimIndent()
        val r = ModelOutputParser.parseRecord(raw, MaizeGuide, guide).getOrThrow()
        assertEquals(listOf(Likelihood.HIGH, Likelihood.MEDIUM), r.possibleCauses.map { it.likelihood })
        assertEquals(Urgency.SOON, r.urgency)
        assertEquals(ModelOutputParser.DEFAULT_UNCERTAINTY, r.uncertaintyNote)
    }

    @Test fun `Likely needs at least two supporting observations`() {
        val raw = """{"summary":"x","possibleCauses":[{"guideId":"sulfur","likelihood":"HIGH","supporting":["one thing"],"checkNext":"look"}]}"""
        assertEquals(Likelihood.MEDIUM, ModelOutputParser.parseRecord(raw, MaizeGuide, guide).getOrThrow().possibleCauses.single().likelihood)
    }

    @Test fun `unknown guide ids are dropped but cause kept by name, missing check falls back to guide`() {
        val raw = """{"summary":"x","possibleCauses":[
            {"guideId":"made_up","name":"Something else","likelihood":"LOW","supporting":[],"checkNext":"Ask an extension officer"},
            {"guideId":"nitrogen","likelihood":"MEDIUM","supporting":["pale"]}]}"""
        val causes = ModelOutputParser.parseRecord(raw, MaizeGuide, guide).getOrThrow().possibleCauses
        assertNull(causes.first { it.name == "Something else" }.guideId)
        val n = causes.first { it.guideId == "nitrogen" }
        assertEquals("Nitrogen deficiency", n.name)
        assertTrue(n.checkNext.isNotBlank())
    }

    @Test fun `record without causes or summary fails`() {
        assertTrue(ModelOutputParser.parseRecord("""{"summary":"x","possibleCauses":[]}""", MaizeGuide, guide).isFailure)
        assertTrue(ModelOutputParser.parseRecord("""{"possibleCauses":[]}""", MaizeGuide, guide).isFailure)
        assertTrue(ModelOutputParser.parseRecord("not json", MaizeGuide, guide).isFailure)
    }

    @Test fun `questions get a Not sure option and are capped`() {
        val raw = """{"questions":[
            {"text":"Are the yellow leaves at the bottom or the top of the plant?","options":["Bottom","Top","Both"]},
            {"text":"Did you apply fertilizer this season?","options":[]},
            {"text":"Third question that should be dropped?","options":["a","b"]}]}"""
        val qs = ModelOutputParser.parseQuestions(raw).getOrThrow()
        assertEquals(2, qs.size)
        assertEquals(listOf("Bottom", "Top", "Both", "Not sure"), qs[0].options)
        assertEquals(listOf("Yes", "No", "Not sure"), qs[1].options)
    }

    @Test fun `review drops hallucinated history references`() {
        val raw = """{"summary":"s","patterns":[{"kind":"WEATHER_LINKED","summary":"after rain","relatedIds":["a","ghost"]}],
            "updatedCauses":[],"nextChecks":["Dig a root"]}"""
        val r = ModelOutputParser.parseReview(raw, setOf("a"), MaizeGuide).getOrThrow()
        assertEquals(listOf("a"), r.patterns.single().relatedIds)
        assertEquals(listOf("Dig a root"), r.nextChecks)
    }
}

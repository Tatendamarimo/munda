package app.munda
import app.munda.domain.*
import org.junit.Assert.*
import org.junit.Test
class AdviceSafetyTest {
    private val guide = Guides.forCrop(Crop.MAIZE)
    @Test fun reviewFiltersDosesAndInventedHistory() {
        val raw = """{"summary":"s","patterns":[{"kind":"SPREADING","summary":"Spreading","relatedIds":["ghost"]}],"nextChecks":["Apply 50 kg per hectare","Compare leaves"]}"""
        val r = ModelOutputParser.parseReview(raw, setOf("real"), guide).getOrThrow()
        assertTrue(r.patterns.isEmpty()); assertEquals(listOf("Compare leaves"), r.nextChecks)
    }
    @Test fun unreviewedCauseRequiresReferral() {
        val raw = """{"summary":"Unknown","possibleCauses":[{"guideId":"other","name":"Unknown cause","likelihood":"HIGH","supporting":["a","b"],"checkNext":"Buy a treatment"}]}"""
        val c = ModelOutputParser.parseRecord(raw, guide, emptySet()).getOrThrow().possibleCauses.single()
        assertEquals(ModelOutputParser.OUTSIDE_GUIDE_CHECK, c.checkNext)
        assertEquals(Likelihood.MEDIUM, c.likelihood)
    }
}

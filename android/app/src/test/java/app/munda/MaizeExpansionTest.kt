package app.munda
import app.munda.domain.*
import app.munda.data.speechChunks
import org.junit.Assert.*
import org.junit.Test
class MaizeExpansionTest {
    private val guide = Guides.forCrop(Crop.MAIZE)
    @Test fun expandedReferencesAreAvailableOffline() {
        for (id in listOf("herbicide_injury", "hail_wind_damage", "cold_frost_injury", "seedling_disease", "root_rot", "stalk_rot")) {
            val e = guide.get(id)!!
            assertTrue(e.sources.isNotEmpty()); assertFalse(e.checkInField.isBlank()); assertFalse(e.distinguish.isBlank())
        }
    }
    @Test fun abstainsWithoutInventingDisease() {
        for (assessment in listOf("UNCERTAIN", "NO_CLEAR_PROBLEM")) {
            val r = ModelOutputParser.parseRecord("""{"assessment":"$assessment","summary":"Observation recorded.","possibleCauses":[],"uncertaintyNote":"Definitely healthy"}""",guide,emptySet()).getOrThrow()
            assertTrue(r.possibleCauses.isEmpty()); assertFalse(r.uncertaintyNote.contains("Definitely healthy"))
        }
    }
    @Test fun mixedProblemsStayTentative() {
        val r = ModelOutputParser.parseRecord("""{"assessment":"MIXED","summary":"Separate symptoms.","possibleCauses":[{"guideId":"nitrogen","likelihood":"HIGH","supporting":["a","b"]}]}""",guide,emptySet()).getOrThrow()
        assertEquals(Likelihood.MEDIUM,r.possibleCauses.single().likelihood)
        assertTrue(r.uncertaintyNote.contains("More than one problem"))
    }
    @Test fun acidSoilReadingRetainsEverySectionInShortPassages() {
        val e=guide.get("acid_soil")!!
        val text=listOfNotNull(e.name,e.signs,e.checkInField,e.distinguish,e.byStage,e.likelyWhen,e.actNow,e.prevent).joinToString(". ")
        val chunks=speechChunks(text,140)
        assertTrue(chunks.all { it.length <= 140 }); assertEquals(text,chunks.joinToString(" "))
        assertTrue(chunks.joinToString(" ").contains(e.prevent!!))
    }
}

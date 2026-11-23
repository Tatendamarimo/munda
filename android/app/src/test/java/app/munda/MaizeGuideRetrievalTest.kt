package app.munda

import app.munda.domain.AffectedArea
import app.munda.domain.CoreAnswers
import app.munda.domain.CropStage
import app.munda.domain.MaizeGuide
import app.munda.domain.Rainfall
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Retrieval eval: for realistic farmer descriptions, the guide entries an agronomist would
 * consider must reach the on-device prompt (top 5). If retrieval misses, the model can't weigh
 * the right cause, so this is the cheapest quality gate we have. Mirrors docs/eval/scenarios.md.
 */
class MaizeGuideRetrievalTest {

    private data class Scenario(
        val name: String,
        val text: String,
        val core: CoreAnswers = CoreAnswers(),
        val stage: CropStage = CropStage.EARLY_GROWTH,
        val mustInclude: Set<String>,
    )

    private val scenarios = listOf(
        Scenario(
            "Yellow lower leaves after heavy rain",
            "The lower leaves are yellowing from the tip down the middle and the plants are not growing well",
            CoreAnswers(AffectedArea.PATCHES, Rainfall.HEAVY),
            mustInclude = setOf("nitrogen", "waterlogging"),
        ),
        Scenario(
            "Yellowing in low spots",
            "Maize is yellow and small in some places",
            CoreAnswers(AffectedArea.LOW_SPOTS, Rainfall.FLOODING),
            mustInclude = setOf("waterlogging", "nitrogen"),
        ),
        Scenario(
            "Ragged holes and sawdust",
            "There are ragged holes in the leaves and something like sawdust inside the funnel",
            mustInclude = setOf("fall_armyworm"),
        ),
        Scenario(
            "Leaf rolling in dry spell",
            "Leaves are rolling and look grey in the afternoon",
            CoreAnswers(AffectedArea.MOST_OF_FIELD, Rainfall.NONE),
            mustInclude = setOf("drought"),
        ),
        Scenario(
            "Thin yellow streaks",
            "Young leaves have thin broken yellow streaks along the lines and plants are stunted",
            CoreAnswers(AffectedArea.FIELD_EDGES),
            mustInclude = setOf("streak_virus"),
        ),
        Scenario(
            "Purple young plants",
            "The young plants are purple on the edges and growing slowly",
            stage = CropStage.EMERGENCE,
            mustInclude = setOf("phosphorus"),
        ),
        Scenario(
            "Burnt leaf edges",
            "Older leaves have brown burnt edges but the middle is green",
            mustInclude = setOf("potassium"),
        ),
        Scenario(
            "Grey rectangular spots",
            "Grey rectangular spots on the lower leaves, very humid this week",
            mustInclude = setOf("grey_leaf_spot"),
        ),
        Scenario(
            "Wilting with pink flowered weeds",
            "Maize is wilting and yellow even though soil is wet, small weeds with pink flowers at the base",
            mustInclude = setOf("striga"),
        ),
        Scenario(
            "Yellow upper leaves",
            "The new top leaves are pale yellow with stripes, bottom leaves look fine",
            mustInclude = setOf("sulfur"),
        ),
    )

    @Test fun `expected causes reach the on-device prompt`() {
        val failures = scenarios.mapNotNull { s ->
            val got = MaizeGuide.relevant(s.text, s.core, s.stage, limit = 5).map { it.id }.toSet()
            val missing = s.mustInclude - got
            if (missing.isEmpty()) null else "${s.name}: missing $missing (got $got)"
        }
        assertTrue(failures.joinToString("\n"), failures.isEmpty())
    }

    @Test fun `word boundaries prevent false matches`() {
        // "lower" must not trigger the "low" keyword (waterlogging low spots).
        val ids = MaizeGuide.relevant("lower leaves yellowing", CoreAnswers(), CropStage.UNKNOWN, limit = 3).map { it.id }
        assertTrue(ids.first() == "nitrogen")
    }

    @Test fun `always returns alternatives`() {
        assertTrue(MaizeGuide.relevant("", CoreAnswers(), CropStage.UNKNOWN, limit = 1).size >= 3)
    }
}

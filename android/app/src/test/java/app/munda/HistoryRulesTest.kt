package app.munda

import app.munda.domain.AffectedArea
import app.munda.domain.CoreAnswers
import app.munda.domain.Crop
import app.munda.domain.CropStage
import app.munda.domain.FieldRecord
import app.munda.domain.HistoryRules
import app.munda.domain.HistoryThresholds
import app.munda.domain.InferenceOrigin
import app.munda.domain.Likelihood
import app.munda.domain.Observation
import app.munda.domain.Pattern
import app.munda.domain.PatternKind
import app.munda.domain.PossibleCause
import app.munda.domain.Rainfall
import app.munda.domain.ReviewStatus
import app.munda.domain.Urgency
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.TimeUnit

class HistoryRulesTest {
    private val t = HistoryThresholds(recurringThreshold = 1, spreadingPlotThreshold = 2, spreadingWindowDays = 14)
    private val day = TimeUnit.DAYS.toMillis(1)

    private fun obs(
        id: String, plot: String = "NORTH", daysAgo: Int = 0,
        cause: String = "nitrogen", likelihood: Likelihood = Likelihood.MEDIUM,
        area: AffectedArea = AffectedArea.PATCHES, rain: Rainfall = Rainfall.LIGHT,
    ) = Observation(
        id = id, orgId = "demo", ownerUid = "u", crop = Crop.MAIZE, plot = plot, plotKey = plot, cropStage = CropStage.EARLY_GROWTH,
        description = "", core = CoreAnswers(area, rain), followUps = emptyList(), hadPhoto = false,
        record = FieldRecord("s", emptyList(), listOf(PossibleCause(cause, cause, likelihood, emptyList(), emptyList(), "c")), Urgency.SOON, ""),
        origin = InferenceOrigin.ON_DEVICE, createdAtMillis = 100 * day - daysAgo * day,
        reviewStatus = ReviewStatus.NOT_STARTED, review = null,
    )

    private fun kinds(p: List<Pattern>) = p.map { it.kind }.toSet()

    @Test fun `recurring when same cause seen before on plot, ignores LOW likelihood`() {
        val target = obs("t")
        assertTrue(PatternKind.RECURRING_ON_PLOT in kinds(HistoryRules.evaluate(target, listOf(obs("a", daysAgo = 20)), emptyList(), t)))
        val weak = listOf(obs("a", daysAgo = 20, likelihood = Likelihood.LOW))
        assertFalse(PatternKind.RECURRING_ON_PLOT in kinds(HistoryRules.evaluate(target, weak, emptyList(), t)))
    }

    @Test fun `worsening compares with most recent prior on plot`() {
        val target = obs("t", area = AffectedArea.MOST_OF_FIELD)
        val history = listOf(obs("old", daysAgo = 30, area = AffectedArea.MOST_OF_FIELD), obs("recent", daysAgo = 5, area = AffectedArea.FEW_PLANTS))
        val w = HistoryRules.evaluate(target, history, emptyList(), t).single { it.kind == PatternKind.WORSENING }
        assertEquals(listOf("recent"), w.relatedIds)
    }

    @Test fun `spreading needs distinct other plots within window`() {
        val target = obs("t", plot = "NORTH")
        val farm = listOf(obs("a", plot = "EAST", daysAgo = 3), obs("b", plot = "EAST", daysAgo = 4))
        assertFalse(PatternKind.SPREADING in kinds(HistoryRules.evaluate(target, emptyList(), farm, t)))
        val farm2 = farm + obs("c", plot = "SOUTH", daysAgo = 2) + obs("old", plot = "WEST", daysAgo = 40)
        val s = HistoryRules.evaluate(target, emptyList(), farm2, t).single { it.kind == PatternKind.SPREADING }
        assertFalse("old" in s.relatedIds)
    }

    @Test fun `weather linked when symptoms repeatedly follow heavy rain`() {
        val target = obs("t", rain = Rainfall.HEAVY)
        val history = listOf(obs("a", daysAgo = 30, rain = Rainfall.FLOODING, cause = "waterlogging"))
        assertTrue(PatternKind.WEATHER_LINKED in kinds(HistoryRules.evaluate(target, history, emptyList(), t)))
    }

    @Test fun `no record means no patterns`() {
        assertTrue(HistoryRules.evaluate(obs("t").copy(record = null), listOf(obs("a", daysAgo = 3)), emptyList(), t).isEmpty())
    }
}

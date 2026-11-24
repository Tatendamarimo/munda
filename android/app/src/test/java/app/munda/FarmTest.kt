package app.munda

import app.munda.domain.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Mirrors web/test/farm.test.ts. */
class FarmTest {
    private var n = 0
    private fun obs(
        plot: String = "River plot", urgency: Urgency? = null, patterns: List<PatternKind>? = null,
        at: Long? = null, core: CoreAnswers = CoreAnswers(),
    ): Observation {
        n += 1
        val record = urgency?.let { FieldRecord("s", emptyList(), emptyList(), it, "u") }
        val review = patterns?.let { HistoryReview("r", it.map { k -> Pattern(k, k.name, emptyList(), FindingSource.RULE) }, emptyList(), emptyList(), 0, 1) }
        return Observation(
            id = "o$n", orgId = "u-x", ownerUid = "u", crop = Crop.MAIZE, plot = plot, plotKey = Normalize.key(plot),
            cropStage = CropStage.EARLY_GROWTH, description = "d", core = core, followUps = emptyList(), hadPhoto = false,
            record = record, origin = InferenceOrigin.ON_DEVICE, createdAtMillis = at ?: (n * 1000L),
            reviewStatus = if (review != null) ReviewStatus.DONE else ReviewStatus.NOT_STARTED, review = review,
        )
    }

    @Test fun `groups by plot key and shows the newest spelling`() {
        val plots = Farm.plots(listOf(obs("river plot ", at = 1), obs("River plot", at = 2)))
        assertEquals(1, plots.size)
        assertEquals("River plot", plots[0].name)
        assertEquals(2, plots[0].count)
        assertEquals(2L, plots[0].lastAt)
    }

    @Test fun `sorts plots by most recent activity`() {
        assertEquals(listOf("B", "A"), Farm.plots(listOf(obs("A", at = 5), obs("B", at = 9))).map { it.name })
    }

    @Test fun `status from latest urgency and review patterns`() {
        fun status(o: Observation) = Farm.plots(listOf(o))[0].status
        assertEquals(PlotStatus.WATCH, status(obs(urgency = Urgency.SOON)))
        assertEquals(PlotStatus.ACT, status(obs(urgency = Urgency.URGENT)))
        assertEquals(PlotStatus.OK, status(obs(urgency = Urgency.ROUTINE)))
        assertEquals(PlotStatus.WATCH, status(obs(urgency = Urgency.ROUTINE, patterns = listOf(PatternKind.WORSENING))))
        assertEquals(PlotStatus.WATCH, status(obs(urgency = Urgency.ROUTINE, patterns = listOf(PatternKind.SPREADING))))
        assertEquals(PlotStatus.OK, status(obs()))
    }

    @Test fun `empty farm`() {
        assertEquals(emptyList<PlotSummary>(), Farm.plots(emptyList()))
        assertEquals(FarmSummary(0, 0), Farm.summary(emptyList()))
        assertNull(Farm.latestAlert(emptyList()))
    }

    @Test fun `counts plots needing a check`() {
        val plots = Farm.plots(listOf(obs("A", Urgency.SOON), obs("B", Urgency.URGENT), obs("C", Urgency.ROUTINE)))
        assertEquals(FarmSummary(3, 2), Farm.summary(plots))
    }

    @Test fun `timeline oldest first with heavy rain marked`() {
        val t = Farm.timeline(listOf(
            obs("A", at = 30, core = CoreAnswers(AffectedArea.MOST_OF_FIELD, Rainfall.FLOODING)),
            obs("A", at = 10, core = CoreAnswers(AffectedArea.FEW_PLANTS, Rainfall.LIGHT)),
            obs("B", at = 20),
            obs("A", at = 20, core = CoreAnswers(AffectedArea.PATCHES, Rainfall.HEAVY)),
        ), Normalize.key("A"))
        assertEquals(listOf(10L, 20L, 30L), t.map { it.at })
        assertEquals(listOf(1, 2, 3), t.map { it.extent })
        assertEquals(listOf(false, true, true), t.map { it.heavyRain })
    }

    @Test fun `alert from the newest observation with patterns`() {
        val older = obs(at = 1, patterns = listOf(PatternKind.RECURRING_ON_PLOT))
        val newer = obs(at = 2, patterns = listOf(PatternKind.WORSENING, PatternKind.WEATHER_LINKED))
        val a = Farm.latestAlert(listOf(older, obs(at = 3), newer))
        assertEquals(newer.id, a?.observation?.id)
        assertEquals(PatternKind.WORSENING, a?.pattern?.kind)
    }

    @Test fun `trail shows where the AI worked`() {
        fun states(o: Observation, synced: Boolean) = Trail.of(o, synced).map { "${it.id}:${it.state}:${it.where}" }
        val base = obs()
        assertEquals(listOf("SAVED:DONE:DEVICE", "CAUSES:WAITING:CLOUD", "SYNCED:WAITING:CLOUD", "REVIEW:WAITING:CLOUD"),
            states(base.copy(record = null, origin = InferenceOrigin.PENDING), false))
        val full = obs(urgency = Urgency.ROUTINE, patterns = emptyList())
        assertEquals(listOf("SAVED:DONE:DEVICE", "CAUSES:DONE:DEVICE", "SYNCED:DONE:CLOUD", "REVIEW:DONE:CLOUD"), states(full, true))
        assertEquals("CAUSES:DONE:CLOUD", states(full.copy(origin = InferenceOrigin.CLOUD), true)[1])
        assertEquals("CAUSES:FAILED:CLOUD", states(base.copy(record = null, recordError = "x"), true)[1])
        assertEquals("REVIEW:FAILED:CLOUD", states(full.copy(reviewStatus = ReviewStatus.FAILED), true)[3])
    }
}

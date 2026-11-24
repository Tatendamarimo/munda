package app.munda.domain

/** Mirrors web/src/domain/farm.ts and trail.ts: farm views derived from observations, no new fields. */

enum class PlotStatus { OK, WATCH, ACT }

data class PlotSummary(val key: String, val name: String, val status: PlotStatus, val lastAt: Long, val count: Int, val latest: Observation)
data class FarmSummary(val plots: Int, val needsCheck: Int)
/** extent: 0 unknown, 1 few plants, 2 patches, 3 most of the field. */
data class TimelinePoint(val id: String, val at: Long, val extent: Int, val heavyRain: Boolean)
data class Alert(val observation: Observation, val pattern: Pattern)

object Farm {
    private val RAISING = setOf(PatternKind.WORSENING, PatternKind.SPREADING)

    private fun statusOf(o: Observation) = when (o.record?.urgency) {
        Urgency.URGENT -> PlotStatus.ACT
        Urgency.SOON -> PlotStatus.WATCH
        else -> if (o.review?.patterns?.any { it.kind in RAISING } == true) PlotStatus.WATCH else PlotStatus.OK
    }

    fun plots(observations: List<Observation>): List<PlotSummary> =
        observations.groupBy { it.plotKey }.map { (key, list) ->
            val latest = list.maxBy { it.createdAtMillis }
            PlotSummary(key, latest.plot.trim(), statusOf(latest), latest.createdAtMillis, list.size, latest)
        }.sortedByDescending { it.lastAt }

    fun timeline(observations: List<Observation>, plotKey: String): List<TimelinePoint> =
        observations.filter { it.plotKey == plotKey }.sortedBy { it.createdAtMillis }
            .map { TimelinePoint(it.id, it.createdAtMillis, it.core.area.extent, it.core.rainfall.isHeavy) }

    fun summary(plots: List<PlotSummary>) = FarmSummary(plots.size, plots.count { it.status != PlotStatus.OK })

    fun latestAlert(observations: List<Observation>): Alert? =
        observations.filter { it.review?.patterns?.isNotEmpty() == true }.maxByOrNull { it.createdAtMillis }
            ?.let { Alert(it, it.review!!.patterns.first()) }
}

enum class TrailId { SAVED, CAUSES, SYNCED, REVIEW }
enum class TrailState { DONE, WAITING, FAILED }
enum class TrailWhere { DEVICE, CLOUD }
data class TrailStep(val id: TrailId, val state: TrailState, val where: TrailWhere)

/** Where the AI worked on one record: the hybrid path, derived from stored state. */
object Trail {
    fun of(o: Observation, synced: Boolean): List<TrailStep> {
        val causes = if (o.record != null) TrailStep(TrailId.CAUSES, TrailState.DONE, if (o.origin == InferenceOrigin.ON_DEVICE) TrailWhere.DEVICE else TrailWhere.CLOUD)
        else TrailStep(TrailId.CAUSES, if (o.recordError != null) TrailState.FAILED else TrailState.WAITING, TrailWhere.CLOUD)
        val review = when (o.reviewStatus) { ReviewStatus.DONE -> TrailState.DONE; ReviewStatus.FAILED -> TrailState.FAILED; else -> TrailState.WAITING }
        return listOf(
            TrailStep(TrailId.SAVED, TrailState.DONE, TrailWhere.DEVICE),
            causes,
            TrailStep(TrailId.SYNCED, if (synced) TrailState.DONE else TrailState.WAITING, TrailWhere.CLOUD),
            TrailStep(TrailId.REVIEW, review, TrailWhere.CLOUD),
        )
    }
}

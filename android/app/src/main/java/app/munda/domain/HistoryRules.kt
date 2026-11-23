package app.munda.domain

import java.util.concurrent.TimeUnit

data class HistoryThresholds(
    /** Prior observations on the same plot sharing a likely cause before we call it recurring. */
    val recurringThreshold: Int,
    /** Distinct *other* plots with the same likely cause (recent) before we call it spreading. */
    val spreadingPlotThreshold: Int,
    val spreadingWindowDays: Int,
)

/**
 * Deterministic history checks. They run before the cloud model so the key signals are
 * reproducible and explainable; the cloud model is asked only for what rules can't express.
 * A cause "matches" between observations when both list it at MEDIUM or above.
 */
object HistoryRules {

    fun evaluate(
        target: Observation,
        plotHistory: List<Observation>,
        farmHistory: List<Observation>,
        t: HistoryThresholds,
    ): List<Pattern> {
        val record = target.record ?: return emptyList()
        val guide = Guides.forCrop(target.crop)
        // Patterns only make sense within one crop.
        @Suppress("NAME_SHADOWING") val plotHistory = plotHistory.filter { it.crop == target.crop }
        @Suppress("NAME_SHADOWING") val farmHistory = farmHistory.filter { it.crop == target.crop }
        val out = mutableListOf<Pattern>()
        val targetCauses = record.candidateIds()

        val priorOnPlot = plotHistory
            .filter { it.id != target.id && it.plotKey == target.plotKey && it.record != null && it.createdAtMillis <= target.createdAtMillis }
            .sortedByDescending { it.createdAtMillis }

        // 1. Recurring: the same likely cause keeps showing up on this plot.
        for (cause in targetCauses) {
            val matches = priorOnPlot.filter { cause in it.record!!.candidateIds() }
            if (matches.size >= t.recurringThreshold) {
                out += Pattern(
                    PatternKind.RECURRING_ON_PLOT,
                    "${guide.get(cause)?.name ?: cause} has come up ${matches.size + 1} times on ${target.plot}. " +
                        "A repeating problem usually has a cause in the field itself (soil, drainage, or a pest that wasn't controlled).",
                    matches.map { it.id }.take(MAX_RELATED),
                    FindingSource.RULE,
                )
                break
            }
        }

        // 2. Worsening: more of the plot is affected than at the last observation.
        priorOnPlot.firstOrNull()?.let { last ->
            if (target.core.area.extent > 0 && last.core.area.extent > 0 && target.core.area.extent > last.core.area.extent) {
                out += Pattern(
                    PatternKind.WORSENING,
                    "Affected area grew from \"${last.core.area.label.lowercase()}\" to \"${target.core.area.label.lowercase()}\" since the last check.",
                    listOf(last.id),
                    FindingSource.RULE,
                )
            }
        }

        // 3. Spreading: other plots on the farm recently showed the same likely cause.
        val since = target.createdAtMillis - TimeUnit.DAYS.toMillis(t.spreadingWindowDays.toLong())
        for (cause in targetCauses) {
            val others = farmHistory.filter {
                it.id != target.id && it.plotKey != target.plotKey && it.createdAtMillis >= since &&
                    it.record != null && cause in it.record.candidateIds()
            }
            val plots = others.map { it.plotKey }.toSet()
            if (plots.size >= t.spreadingPlotThreshold) {
                out += Pattern(
                    PatternKind.SPREADING,
                    "${guide.get(cause)?.name ?: cause} was also suspected on ${plots.size} other plot(s) in the last ${t.spreadingWindowDays} days.",
                    others.map { it.id }.take(MAX_RELATED),
                    FindingSource.RULE,
                )
                break
            }
        }

        // 4. Weather-linked: symptoms on this plot repeatedly follow heavy rain.
        if (target.core.rainfall.isHeavy) {
            val afterRain = priorOnPlot.filter { it.core.rainfall.isHeavy }
            if (afterRain.isNotEmpty()) {
                out += Pattern(
                    PatternKind.WEATHER_LINKED,
                    "Problems on ${target.plot} were also recorded after heavy rain before. " +
                        "That points towards drainage (waterlogging) or nutrients washed out of the soil (leaching).",
                    afterRain.map { it.id }.take(MAX_RELATED),
                    FindingSource.RULE,
                )
            }
        }
        return out
    }

    /** Rule findings win; AI findings of the same kind are dropped to avoid duplicates. */
    fun merge(rules: List<Pattern>, ai: List<Pattern>): List<Pattern> {
        val kinds = rules.map { it.kind }.toSet()
        return rules + ai.filter { it.kind !in kinds }
    }

    private fun FieldRecord.candidateIds(): Set<String> =
        possibleCauses.filter { it.likelihood != Likelihood.LOW }.mapNotNull { it.guideId }.toSet()

    private const val MAX_RELATED = 10
}

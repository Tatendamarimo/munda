package app.munda.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Embedded so it works offline. The on-device model only accepts ~4k tokens, so we send it the
 * few entries that match the observation ([relevant]); the cloud review gets the whole guide.
 */
object MaizeGuide : SymptomGuide {

    override val crop = Crop.MAIZE

    /**
     * shared/guides/maize.json, the same file the web app uses (bundled as an asset). The app sets
     * this before first use; JVM tests read the repo file.
     */
    @Volatile var source: () -> String = { java.io.File("../../shared/guides/maize.json").readText() }

    override val entries: List<GuideEntry> by lazy { parse(source()) }

    private val byId by lazy { entries.associateBy { it.id } }
    private val index by lazy { KeywordIndex(entries) }

    override fun get(id: String?): GuideEntry? = id?.let { byId[it] }

    /**
     * Cheap, deterministic, offline retrieval: keyword hits plus maize-specific context boosts
     * from the core answers.
     */
    override fun relevant(text: String, core: CoreAnswers, stage: CropStage, limit: Int): List<GuideEntry> {
        val scored = entries.map { e ->
            var score = index.score(e, text)
            when (e.id) {
                "waterlogging" -> {
                    if (core.rainfall.isHeavy) score += 2.0
                    if (core.area == AffectedArea.LOW_SPOTS) score += 3.0
                }
                "nitrogen" -> if (core.rainfall.isHeavy) score += 1.0 // leaching
                "drought" -> if (core.rainfall == Rainfall.NONE) score += 3.0 else if (core.rainfall.isHeavy) score -= 2.0
                "streak_virus" -> if (core.area == AffectedArea.FIELD_EDGES || core.area == AffectedArea.FEW_PLANTS) score += 0.5
                "phosphorus" -> if (stage == CropStage.EMERGENCE || stage == CropStage.EARLY_GROWTH) score += 0.5
                "fall_armyworm" -> if (stage == CropStage.EARLY_GROWTH || stage == CropStage.LATE_GROWTH) score += 0.5
            }
            e to score
        }
        return scored.sortedByDescending { it.second }.take(limit.coerceAtLeast(MIN_RESULTS)).map { it.first }
    }

    private const val MIN_RESULTS = 3

    @Serializable private data class Src(val title: String, val url: String)
    @Serializable private data class Raw(
        val id: String, val name: String, val category: String, val keywords: List<String>, val signs: String,
        val distinguish: String, val checkInField: String, val byStage: String? = null, val likelyWhen: String? = null,
        val actNow: String? = null, val prevent: String? = null, val report: Boolean = false, val sources: List<Src> = emptyList(),
    )
    @Serializable private data class File(val entries: List<Raw>)

    fun parse(json: String): List<GuideEntry> = Json { ignoreUnknownKeys = true }.decodeFromString<File>(json).entries.map {
        GuideEntry(it.id, it.name, GuideCategory.valueOf(it.category), it.keywords, it.signs, it.distinguish, it.checkInField,
            it.byStage, it.likelyWhen, it.actNow, it.prevent, it.report, it.sources.map { s -> GuideSource(s.title, s.url) })
    }
}

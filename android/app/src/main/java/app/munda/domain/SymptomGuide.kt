package app.munda.domain

/**
 * Extension seam: each crop has its own guide (and, later, each livestock species).
 * Everything downstream (prompts, retrieval, parsing, history rules) asks [Guides] for the guide
 * matching an observation, so adding a crop means adding a guide and an enum value, not
 * touching the pipeline. See docs/adr/0004-multi-crop-and-livestock.md.
 */
enum class Crop(val label: String) {
    MAIZE("Maize");

    companion object { fun parse(raw: String?) = entries.firstOrNull { it.name == raw } ?: MAIZE }
}

enum class GuideCategory { NUTRIENT, WATER, PEST, DISEASE, WEED, STRESS }

/** One problem the assistant may suggest: reference material for the model, not a diagnosis tool. */
data class GuideEntry(
    val id: String,
    val name: String,
    val category: GuideCategory,
    /** Lower-case words/phrases a farmer might use. Used for on-device retrieval. */
    val keywords: List<String>,
    val signs: String,
    /** What separates this from look-alikes; used to generate discriminating questions. */
    val distinguish: String,
    val checkInField: String,
    /** What it looks like at different crop stages. */
    val byStage: String? = null,
    /** Season, weather, soil or practice that makes it likely. */
    val likelyWhen: String? = null,
    /** What a farmer can do now, without product names or doses. */
    val actNow: String? = null,
    val prevent: String? = null,
    /** Must be reported to the authorities (e.g. MLN). */
    val report: Boolean = false,
    val sources: List<GuideSource> = emptyList(),
)

data class GuideSource(val title: String, val url: String)

interface SymptomGuide {
    val crop: Crop
    val entries: List<GuideEntry>
    fun get(id: String?): GuideEntry?

    /** Top entries for this observation; always returns several so the model weighs alternatives. */
    fun relevant(text: String, core: CoreAnswers, stage: CropStage, limit: Int = 5): List<GuideEntry>
}

object Guides {
    fun forCrop(crop: Crop): SymptomGuide = when (crop) {
        Crop.MAIZE -> MaizeGuide
    }
}

/**
 * Shared keyword retrieval so every crop guide scores text the same way. Word-boundary matching
 * with simple inflections: "low" doesn't match "lower leaves", but "yellow" matches "yellowing".
 * Multi-word phrases weigh more than single words because they're more specific.
 */
class KeywordIndex(entries: List<GuideEntry>) {
    private val patterns: Map<String, List<Pair<String, Regex>>> = entries.associate { e ->
        e.id to e.keywords.map { k -> k to Regex("(^|[^a-z])${Regex.escape(k)}(s|es|ed|ing)?($|[^a-z])") }
    }

    fun score(entry: GuideEntry, text: String): Double {
        val t = text.lowercase().replace(Regex("[^a-z0-9 \\-]"), " ")
        return patterns.getValue(entry.id).sumOf { (phrase, rx) ->
            if (rx.containsMatchIn(t)) (if (phrase.contains(' ')) 2.0 else 1.0) else 0.0
        }
    }
}

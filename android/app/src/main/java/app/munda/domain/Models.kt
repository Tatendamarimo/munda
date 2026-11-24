package app.munda.domain

/**
 * Core domain types. No Android/Firebase imports, so routing, parsing, retrieval and history
 * rules are unit-tested on the JVM.
 *
 * Design rule: Munda never diagnoses. Every finding is a [PossibleCause] with a visible
 * [Likelihood], the observations that support it, what's missing or contradicts it, and a
 * concrete check the farmer can do next.
 */

enum class CropStage(val label: String, val hint: String) {
    EMERGENCE("Emergence", "First 2 leaves"),
    EARLY_GROWTH("Early growth", "3–6 leaves, up to knee-high"),
    LATE_GROWTH("Late growth", "Knee-high to tassel"),
    TASSELING("Tasseling / silking", "Tassels or silks showing"),
    GRAIN_FILL("Grain fill", "Cobs filling"),
    MATURITY("Maturity", "Drying down"),
    UNKNOWN("Not sure", "");

    companion object { fun parse(raw: String?) = entries.firstOrNull { it.name == raw } ?: UNKNOWN }
}

/** Core question 1: how much of the field is affected. Ordered roughly by extent. */
enum class AffectedArea(val label: String, val extent: Int) {
    FEW_PLANTS("A few plants", 1),
    PATCHES("Patches", 2),
    LOW_SPOTS("Low-lying spots", 2),
    FIELD_EDGES("Field edges", 2),
    MOST_OF_FIELD("Most of the field", 3),
    UNKNOWN("Not sure", 0);

    companion object { fun parse(raw: String?) = entries.firstOrNull { it.name == raw } ?: UNKNOWN }
}

/** Core question 2: rainfall in the last two weeks. */
enum class Rainfall(val label: String) {
    NONE("No rain"),
    LIGHT("Light rain"),
    HEAVY("Heavy rain"),
    FLOODING("Standing water / flooding"),
    UNKNOWN("Not sure");

    val isHeavy get() = this == HEAVY || this == FLOODING

    companion object { fun parse(raw: String?) = entries.firstOrNull { it.name == raw } ?: UNKNOWN }
}

/** Core question 3: when symptoms were first noticed. */
enum class Onset(val label: String) {
    RECENT("Today or yesterday"),
    THIS_WEEK("This week"),
    ONE_TO_TWO_WEEKS("1–2 weeks ago"),
    LONGER("More than 2 weeks ago"),
    UNKNOWN("Not sure");

    companion object { fun parse(raw: String?) = entries.firstOrNull { it.name == raw } ?: UNKNOWN }
}

data class CoreAnswers(
    val area: AffectedArea = AffectedArea.UNKNOWN,
    val rainfall: Rainfall = Rainfall.UNKNOWN,
    val onset: Onset = Onset.UNKNOWN,
)

/** An AI-generated, symptom-specific question designed to tell candidate causes apart. */
data class FollowUpQuestion(val text: String, val options: List<String>)

data class QA(val question: String, val answer: String)

enum class Likelihood(val label: String) { LOW("Less likely"), MEDIUM("Possible"), HIGH("Likely");
    companion object {
        fun parse(raw: String?) = entries.firstOrNull { it.name.equals(raw?.trim(), ignoreCase = true) } ?: LOW
    }
}

enum class Urgency(val label: String) { ROUTINE("Monitor"), SOON("Act this week"), URGENT("Act now");
    companion object {
        fun parse(raw: String?) = entries.firstOrNull { it.name.equals(raw?.trim(), ignoreCase = true) } ?: SOON
    }
}

data class PossibleCause(
    /** Id in [MaizeGuide] when the cause matches a guide entry; null for causes outside the guide. */
    val guideId: String?,
    val name: String,
    val likelihood: Likelihood,
    val supporting: List<String>,
    val againstOrMissing: List<String>,
    val checkNext: String,
)

/** The structured field record built from the farmer's observation and answers. */
data class FieldRecord(
    val summary: String,
    val symptoms: List<String>,
    val possibleCauses: List<PossibleCause>,
    val urgency: Urgency,
    val uncertaintyNote: String,
)

/** Where the record was actually generated; shown on every observation. */
enum class InferenceOrigin { ON_DEVICE, CLOUD, PENDING;
    companion object { fun parse(raw: String?) = entries.firstOrNull { it.name == raw } ?: PENDING }
}

enum class ReviewStatus { NOT_STARTED, DONE, FAILED;
    companion object { fun parse(raw: String?) = entries.firstOrNull { it.name == raw } ?: NOT_STARTED }
}

enum class PatternKind(val label: String) {
    RECURRING_ON_PLOT("Keeps coming back"),
    SPREADING("Spreading to other plots"),
    WORSENING("Getting worse"),
    WEATHER_LINKED("Linked to rain"),
    OTHER("Pattern");

    companion object { fun parse(raw: String?) = entries.firstOrNull { it.name == raw } ?: OTHER }
}

enum class FindingSource { RULE, CLOUD_AI;
    companion object { fun parse(raw: String?) = entries.firstOrNull { it.name == raw } ?: RULE }
}

data class Pattern(
    val kind: PatternKind,
    val summary: String,
    val relatedIds: List<String>,
    val source: FindingSource,
)

/** Cloud review of this observation in the context of the plot's and farm's history. */
data class HistoryReview(
    val summary: String,
    val patterns: List<Pattern>,
    val updatedCauses: List<PossibleCause>,
    val nextChecks: List<String>,
    val reviewedAtMillis: Long,
    val historyConsidered: Int,
)

data class Observation(
    val id: String,
    val orgId: String,
    val ownerUid: String,
    val crop: Crop,
    /** As the farmer typed it, for display. */
    val plot: String,
    /** Normalised, for history queries. */
    val plotKey: String,
    val cropStage: CropStage,
    val description: String,
    val core: CoreAnswers,
    val followUps: List<QA>,
    val hadPhoto: Boolean,
    val record: FieldRecord?,
    val origin: InferenceOrigin,
    val createdAtMillis: Long,
    val reviewStatus: ReviewStatus,
    val review: HistoryReview?,
    val recordError: String? = null,
)

object Normalize {
    fun key(raw: String): String = raw.trim().uppercase().replace(Regex("\\s+"), "-").take(MAX_KEY)

    const val MAX_KEY = 64
    const val MAX_DESCRIPTION = 8_000
    const val MAX_ANSWER = 200
}

/** Firestore rules need a description; a photo alone is a complete observation for the farmer. */
const val PHOTO_ONLY = "Leaf photo only; the farmer gave no description."

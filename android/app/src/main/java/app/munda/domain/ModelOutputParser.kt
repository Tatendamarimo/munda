package app.munda.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Model output is untrusted. Parse leniently (small on-device models sometimes wrap JSON in
 * fences or add fields), validate strictly, and enforce the uncertainty rules in code so they
 * hold even when a model ignores the prompt:
 *
 *  - A cause can only be "Likely" with at least [MIN_SUPPORT_FOR_HIGH] supporting observations.
 *  - At most one cause can be "Likely"; it's an observation, not a verdict.
 *  - Every cause must say what to check next.
 *  - Guide ids and history references must be ones we actually sent.
 */
object ModelOutputParser {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true; coerceInputValues = true; explicitNulls = false }

    @Serializable private data class QuestionDto(val text: String? = null, val options: List<String>? = null)
    @Serializable private data class QuestionsDto(val questions: List<QuestionDto>? = null)

    @Serializable private data class CauseDto(
        val guideId: String? = null,
        val name: String? = null,
        val likelihood: String? = null,
        val supporting: List<String>? = null,
        val againstOrMissing: List<String>? = null,
        val checkNext: String? = null,
    )

    @Serializable private data class RecordDto(
        val summary: String? = null,
        val symptoms: List<String>? = null,
        val possibleCauses: List<CauseDto>? = null,
        val urgency: String? = null,
        val uncertaintyNote: String? = null,
    )

    @Serializable private data class PatternDto(val kind: String? = null, val summary: String? = null, val relatedIds: List<String>? = null)
    @Serializable private data class ReviewDto(
        val summary: String? = null,
        val patterns: List<PatternDto>? = null,
        val updatedCauses: List<CauseDto>? = null,
        val nextChecks: List<String>? = null,
    )

    @Serializable private data class PhotoDto(val signs: String? = null, val clear: Boolean? = null)

    /** What the AI saw in a photo; an empty description counts as unclear (web: parsePhotoSigns). */
    fun parsePhotoSigns(raw: String?): Result<PhotoSigns> = runCatching {
        val dto = json.decodeFromString(PhotoDto.serializer(), extractJsonObject(raw))
        val signs = dto.signs?.clean(300).orEmpty()
        PhotoSigns(signs, signs.isNotEmpty() && dto.clear != false)
    }

    fun parseQuestions(raw: String?): Result<List<FollowUpQuestion>> = runCatching {
        json.decodeFromString(QuestionsDto.serializer(), extractJsonObject(raw)).questions.orEmpty()
            .mapNotNull { q ->
                val text = q.text?.clean(MAX_QUESTION)?.takeIf { it.length >= 8 } ?: return@mapNotNull null
                val options = q.options.cleanList(MAX_OPTION_LEN, MAX_OPTIONS)
                FollowUpQuestion(text, if (options.size >= 2) options + NOT_SURE else listOf("Yes", "No", NOT_SURE))
            }
            .distinctBy { it.text.lowercase() }
            .take(MAX_QUESTIONS)
    }

    fun parseRecord(raw: String?, guide: SymptomGuide, allowedGuideIds: Set<String>, maxCauses: Int = 3): Result<FieldRecord> = runCatching {
        val dto = json.decodeFromString(RecordDto.serializer(), extractJsonObject(raw))
        val summary = dto.summary?.clean(MAX_SUMMARY)
        require(!summary.isNullOrBlank()) { "Model returned no summary" }
        val causes = causes(dto.possibleCauses, guide, allowedGuideIds, maxCauses)
        require(causes.isNotEmpty()) { "Model returned no possible causes" }
        FieldRecord(
            summary = summary,
            symptoms = dto.symptoms.cleanList(MAX_ITEM, 5),
            possibleCauses = causes,
            urgency = Urgency.parse(dto.urgency),
            uncertaintyNote = dto.uncertaintyNote?.clean(MAX_NOTE)?.takeIf { it.isNotBlank() } ?: DEFAULT_UNCERTAINTY,
        )
    }

    fun parseReview(raw: String?, knownIds: Set<String>, guide: SymptomGuide): Result<ReviewParts> = runCatching {
        val dto = json.decodeFromString(ReviewDto.serializer(), extractJsonObject(raw))
        ReviewParts(
            summary = dto.summary?.clean(MAX_NOTE).orEmpty(),
            patterns = dto.patterns.orEmpty().mapNotNull { p ->
                val s = p.summary?.clean(MAX_NOTE)?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                Pattern(
                    kind = PatternKind.parse(p.kind),
                    summary = s,
                    relatedIds = p.relatedIds.orEmpty().filter { it in knownIds }.distinct().take(MAX_RELATED),
                    source = FindingSource.CLOUD_AI,
                )
            }.take(3),
            updatedCauses = causes(dto.updatedCauses, guide, guide.entries.map { it.id }.toSet(), 4),
            nextChecks = dto.nextChecks.cleanList(MAX_CHECK, 4),
        )
    }

    data class ReviewParts(
        val summary: String,
        val patterns: List<Pattern>,
        val updatedCauses: List<PossibleCause>,
        val nextChecks: List<String>,
    )

    /** A dose or rate: advice never carries one, whatever the model says (web: parser.ts DOSE). */
    private val DOSE = Regex("""\b\d+([.,]\d+)?\s?(ml|mls|millilit(re|er)s?|l|lit(re|er)s?|g|grams?|kg|kgs|cc|tonnes?)\b|\bper\s+(hectare|ha|acre|lit(re|er)|knapsack)\b""", RegexOption.IGNORE_CASE)
    private fun String.noDose() = !DOSE.containsMatchIn(this)
    const val OUTSIDE_GUIDE_CHECK = "Check with your extension officer before buying anything."
    /** Gemini's own suggestion outside the guide: unverified, so never "Likely", and one per answer. */
    private const val MAX_OUTSIDE_GUIDE = 1

    private fun causes(raw: List<CauseDto>?, guide: SymptomGuide, allowedGuideIds: Set<String>, max: Int): List<PossibleCause> {
        var outside = 0
        val parsed = raw.orEmpty().mapNotNull { c ->
            // Any real guide entry counts, even one the shortlist missed: its text is checked.
            val id = c.guideId?.trim()
            val guideId = id?.takeIf { it in allowedGuideIds || guide.get(it) != null }
            val entry = guide.get(guideId)
            if (entry == null && outside >= MAX_OUTSIDE_GUIDE) return@mapNotNull null
            val name = c.name?.clean(MAX_ITEM)?.takeIf { it.isNotBlank() } ?: entry?.name ?: return@mapNotNull null
            val supporting = c.supporting.cleanList(MAX_ITEM, 4).filter { it.noDose() }
            val proposed = c.checkNext?.clean(MAX_CHECK)?.takeIf { it.isNotBlank() }
            val check = proposed?.takeIf { it.noDose() } ?: entry?.checkInField ?: proposed?.let { OUTSIDE_GUIDE_CHECK } ?: return@mapNotNull null
            var likelihood = Likelihood.parse(c.likelihood)
            if (likelihood == Likelihood.HIGH && (supporting.size < MIN_SUPPORT_FOR_HIGH || entry == null)) likelihood = Likelihood.MEDIUM
            if (entry == null) outside++
            PossibleCause(guideId, name, likelihood, supporting, c.againstOrMissing.cleanList(MAX_ITEM, 4).filter { it.noDose() }, check)
        }.distinctBy { it.guideId ?: it.name.lowercase() }

        // Only one cause may be "Likely": keep the best-supported one, downgrade the rest.
        var seenHigh = false
        return parsed
            .sortedWith(compareByDescending<PossibleCause> { it.likelihood.ordinal }.thenByDescending { it.supporting.size })
            .map { c ->
                if (c.likelihood == Likelihood.HIGH) {
                    if (seenHigh) c.copy(likelihood = Likelihood.MEDIUM) else { seenHigh = true; c }
                } else c
            }
            .take(max)
    }

    internal fun extractJsonObject(raw: String?): String {
        requireNotNull(raw) { "Empty model response" }
        val start = raw.indexOf('{')
        val end = raw.lastIndexOf('}')
        require(start >= 0 && end > start) { "No JSON object in model response" }
        return raw.substring(start, end + 1)
    }

    private fun String.clean(max: Int) = trim().replace(Regex("\\s+"), " ").take(max)
    private fun List<String>?.cleanList(maxLen: Int, max: Int) =
        orEmpty().map { it.clean(maxLen) }.filter { it.isNotBlank() }.distinctBy { it.lowercase() }.take(max)

    const val NOT_SURE = "Not sure"
    const val DEFAULT_UNCERTAINTY =
        "These are possible causes based on what you described, not a diagnosis. Check them in the field before spending money on inputs."
    private const val MIN_SUPPORT_FOR_HIGH = 2
    private const val MAX_QUESTIONS = 2
    private const val MAX_OPTIONS = 4
    private const val MAX_OPTION_LEN = 40
    private const val MAX_QUESTION = 140
    private const val MAX_SUMMARY = 280
    private const val MAX_ITEM = 120
    private const val MAX_CHECK = 240
    private const val MAX_NOTE = 400
    private const val MAX_RELATED = 10
}

data class PhotoSigns(val signs: String, val clear: Boolean)

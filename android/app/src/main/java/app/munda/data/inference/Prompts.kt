package app.munda.data.inference

import app.munda.domain.FieldRecord
import app.munda.domain.GuideEntry
import app.munda.domain.Likelihood
import app.munda.domain.Guides
import app.munda.domain.Observation
import app.munda.domain.PatternKind
import app.munda.domain.Urgency
import com.google.firebase.ai.type.Schema
import java.time.Instant
import java.time.ZoneOffset

/**
 * Prompts and response schemas. On-device prompts are sized for Gemini Nano's ~4k-token input
 * and ~256-token sweet spot for output: only the retrieved guide entries, short instructions,
 * compact schemas.
 */
internal object Prompts {

    // ---------- Follow-up questions (on-device first) ----------

    val questionsSchema: Schema = Schema.obj(
        mapOf(
            "questions" to Schema.array(
                Schema.obj(
                    mapOf(
                        "text" to Schema.string("A short question a farmer can answer by looking at the plants."),
                        "options" to Schema.array(Schema.string(), "2 to 4 short answer choices", maxItems = 4),
                    ),
                ),
                maxItems = 2,
            ),
        ),
    )

    fun questions(input: ObservationInput, candidates: List<GuideEntry>): String = buildString {
        appendLine("You help a ${input.crop.label.lowercase()} farmer narrow down what might be wrong in their field.")
        appendLine("Ask at most 2 short, simple questions whose answers best tell apart the possible causes below.")
        appendLine("Each question must be answerable by looking at the plants or the soil. Give 2-4 short answer choices.")
        appendLine("Do NOT ask how much of the field is affected, about rainfall, or when it started; those are already answered.")
        appendLine()
        appendLine("Crop stage: ${input.stage.label}")
        appendLine("Farmer says: ${input.description.trim()}")
        if (input.hasPhoto) appendLine("(A photo of the plant is attached.)")
        appendLine()
        appendLine("Possible causes and how they differ:")
        candidates.forEach { appendLine("- ${it.name}: ${it.distinguish}") }
        append("Respond with JSON only.")
    }

    // ---------- Field record (on-device first) ----------

    private val causeSchema = Schema.obj(
        mapOf(
            "guideId" to Schema.string("Id of the matching guide entry, or \"other\"."),
            "name" to Schema.string(),
            "likelihood" to Schema.enumeration(Likelihood.entries.map { it.name }),
            "supporting" to Schema.array(Schema.string(), "Observations that support this cause", maxItems = 3),
            "againstOrMissing" to Schema.array(Schema.string(), "Observations that argue against it, or information still missing", maxItems = 3),
            "checkNext" to Schema.string("One concrete check the farmer can do in the field."),
        ),
    )

    val recordSchema: Schema = Schema.obj(
        mapOf(
            "summary" to Schema.string("One sentence, at most 25 words, describing what was observed."),
            "symptoms" to Schema.array(Schema.string(), maxItems = 5),
            "possibleCauses" to Schema.array(causeSchema, maxItems = 3),
            "urgency" to Schema.enumeration(Urgency.entries.map { it.name }),
            "uncertaintyNote" to Schema.string("One sentence: what information would most change this assessment."),
        ),
    )

    fun record(input: ObservationInput, candidates: List<GuideEntry>): String = buildString {
        appendLine("You help a ${input.crop.label.lowercase()} farmer record a field observation. You do NOT diagnose.")
        appendLine("List up to 3 POSSIBLE causes, most likely first, using only the guide entries below (or \"other\").")
        appendLine("Rules:")
        appendLine("- likelihood HIGH only if at least 2 observations support it and nothing contradicts it. Otherwise MEDIUM or LOW.")
        appendLine("- supporting: only things the farmer actually said or the photo clearly shows.")
        appendLine("- againstOrMissing: what contradicts it or what we still don't know.")
        appendLine("- checkNext: something the farmer can check with their eyes or hands. No product names or doses.")
        appendLine("- urgency: URGENT only for a pest or disease that can spread fast, or risk to most of the field; ROUTINE if minor.")
        appendLine("- Use short, plain words.")
        appendLine()
        appendLine("GUIDE")
        candidates.forEach { appendLine(it.line()) }
        appendLine()
        appendObservation(input)
        append("Respond with JSON only.")
    }

    private fun StringBuilder.appendObservation(input: ObservationInput) {
        appendLine("OBSERVATION")
        appendLine("Plot: ${input.plot}. Crop: ${input.crop.label.lowercase()}, stage ${input.stage.label}.")
        appendLine("Farmer says: ${input.description.trim()}")
        appendLine("How much is affected: ${input.core.area.label}. Rain in last 2 weeks: ${input.core.rainfall.label}. Started: ${input.core.onset.label}.")
        input.followUps.forEach { appendLine("Q: ${it.question} A: ${it.answer}") }
        if (input.hasPhoto) appendLine("A photo is attached; treat it as supporting evidence only.")
    }

    private fun GuideEntry.line() = "id=$id | $name | signs: $signs | tells apart: $distinguish | check: $checkInField"

    // ---------- History review (cloud only) ----------

    val reviewSchema: Schema = Schema.obj(
        mapOf(
            "summary" to Schema.string("2 sentences max: what the history adds to today's observation."),
            "patterns" to Schema.array(
                Schema.obj(
                    mapOf(
                        "kind" to Schema.enumeration(PatternKind.entries.map { it.name }),
                        "summary" to Schema.string(),
                        "relatedIds" to Schema.array(Schema.string()),
                    ),
                ),
                maxItems = 3,
            ),
            "updatedCauses" to Schema.array(causeSchema, maxItems = 4),
            "nextChecks" to Schema.array(Schema.string(), "Most useful first", maxItems = 4),
        ),
    )

    fun review(target: Observation, plotHistory: List<Observation>, farmHistory: List<Observation>, ruleKinds: List<PatternKind>): String = buildString {
        appendLine("You are an agronomy assistant reviewing a ${target.crop.label.lowercase()} farmer's field records. You do NOT diagnose.")
        appendLine("Using the history, update the possible causes for TODAY's observation and suggest what to check next.")
        appendLine("Same likelihood rules: HIGH only with 2+ supporting observations and no contradiction. Keep uncertainty visible.")
        appendLine("Only describe patterns that the records below support, and cite record ids in relatedIds.")
        appendLine("No product names or doses. If the situation may need an expert (e.g. suspected virus or lethal necrosis), say to contact an extension officer.")
        if (ruleKinds.isNotEmpty()) appendLine("Patterns already found by rules (do not repeat): ${ruleKinds.joinToString { it.name }}.")
        appendLine()
        appendLine("GUIDE")
        Guides.forCrop(target.crop).entries.forEach { appendLine(it.line()) }
        appendLine()
        appendLine("TODAY")
        appendLine(target.line())
        target.followUps.forEach { appendLine("  Q: ${it.question} A: ${it.answer}") }
        appendLine()
        appendLine("SAME PLOT, EARLIER (newest first)")
        plotHistory.filter { it.id != target.id }.ifEmpty { null }?.forEach { appendLine(it.line()) } ?: appendLine("none")
        appendLine()
        appendLine("OTHER PLOTS, RECENT (newest first)")
        farmHistory.filter { it.id != target.id && it.plotKey != target.plotKey }.ifEmpty { null }?.forEach { appendLine(it.line()) } ?: appendLine("none")
    }

    private fun Observation.line(): String {
        val date = Instant.ofEpochMilli(createdAtMillis).atOffset(ZoneOffset.UTC).toLocalDate()
        val base = "id=$id | $date | plot=$plot | stage=${cropStage.name} | area=${core.area.name} | rain=${core.rainfall.name} | onset=${core.onset.name} | \"${description.take(300)}\""
        return record?.let { "$base | causes: ${it.causesLine()}" } ?: base
    }

    private fun FieldRecord.causesLine() = possibleCauses.joinToString("; ") { "${it.guideId ?: it.name}=${it.likelihood}" }
}

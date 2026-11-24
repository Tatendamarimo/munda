package app.munda.domain

import kotlinx.serialization.json.*

data class LiveCause(val guideId: String?, val name: String?, val likelihood: Likelihood?, val supporting: List<String>, val against: List<String>)
data class LivePreview(val summary: String?, val causes: List<LiveCause>)

/**
 * Best-effort parse of the start of a JSON object, for showing the AI's answer while it's still
 * being written. Mirrors web/src/domain/partialJson.ts. Display only: the finished text still goes
 * through ModelOutputParser.
 */
object PartialJson {
    private data class Frame(val obj: Boolean, var expect: Char) // k(ey) c(olon) v(alue) ,(comma)

    fun parse(text: String): JsonElement? {
        val start = text.indexOf('{')
        if (start < 0) return null
        val stack = ArrayList<Frame>()
        var safeEnd = start
        var safeStack: List<Frame> = emptyList()
        fun mark(end: Int) { safeEnd = end; safeStack = stack.map { it.copy() } }
        var inString = false
        var stringIsValue = false
        var stringStart = 0
        fun afterValue() { stack.lastOrNull()?.expect = ',' }

        var i = start
        loop@ while (i < text.length) {
            val c = text[i]
            if (inString) {
                if (c == '\\') { i += 2; continue }
                if (c == '"') {
                    inString = false
                    if (stringIsValue) { afterValue(); mark(i + 1) } else stack.last().expect = 'c'
                }
                i++; continue
            }
            val top = stack.lastOrNull()
            when {
                c == '"' -> { inString = true; stringStart = i; stringIsValue = top == null || !top.obj || top.expect == 'v' }
                c == '{' || c == '[' -> { stack.add(Frame(c == '{', if (c == '{') 'k' else 'v')); mark(i + 1) }
                c == '}' || c == ']' -> { stack.removeAt(stack.lastIndex); afterValue(); mark(i + 1); if (stack.isEmpty()) break@loop }
                c == ':' -> top?.expect = 'v'
                c == ',' -> { if (top?.expect == 'v' || top?.expect == ',') mark(i); top?.expect = if (top?.obj == true) 'k' else 'v' }
                !c.isWhitespace() && top?.expect == 'v' -> top.expect = ','
            }
            i++
        }

        fun closers(s: List<Frame>) = s.reversed().joinToString("") { if (it.obj) "}" else "]" }
        val candidate = if (inString && stringIsValue) {
            val body = text.substring(stringStart).replace(Regex("""\\u[0-9a-fA-F]{0,3}$|\\$"""), "")
            text.substring(start, stringStart) + body + "\"" + closers(stack)
        } else text.substring(start, safeEnd) + closers(safeStack)
        return runCatching { Json.parseToJsonElement(candidate) }.getOrNull()
            ?: runCatching { Json.parseToJsonElement(text.substring(start, safeEnd) + closers(safeStack)) }.getOrNull()
    }

    private fun JsonElement?.str() = (this as? JsonPrimitive)?.takeIf { it.isString }?.content?.takeIf { it.isNotBlank() }
    private fun JsonElement?.strs() = (this as? JsonArray)?.mapNotNull { it.str() } ?: emptyList()

    fun preview(text: String): LivePreview {
        val o = parse(text) as? JsonObject ?: return LivePreview(null, emptyList())
        val causes = (o["possibleCauses"] as? JsonArray)?.mapNotNull { it as? JsonObject }?.map { c ->
            LiveCause(
                guideId = c["guideId"].str(),
                name = c["name"].str(),
                likelihood = c["likelihood"].str()?.let { l -> Likelihood.entries.firstOrNull { it.name == l } },
                supporting = c["supporting"].strs(),
                against = c["againstOrMissing"].strs(),
            )
        } ?: emptyList()
        return LivePreview(o["summary"].str(), causes)
    }
}

package app.munda
import app.munda.data.speechChunks
import org.junit.Assert.*
import org.junit.Test
class SpeechChunksTest {
    @Test fun completeLongReading() {
        val text = "Inspect lower leaves. Compare upper leaves. ".repeat(60) + "Final safety note."
        val chunks = speechChunks(text)
        assertTrue(chunks.all { it.length <= 600 })
        assertEquals(text.trim(), chunks.joinToString(" "))
        assertTrue(chunks.last().endsWith("Final safety note."))
    }
    @Test fun handlesEmptyAndUnbrokenText() {
        assertTrue(speechChunks(" ").isEmpty())
        assertEquals("x".repeat(1400), speechChunks("x".repeat(1400)).joinToString(""))
    }
}

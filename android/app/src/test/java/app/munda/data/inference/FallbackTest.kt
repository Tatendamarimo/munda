package app.munda.data.inference

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/** Mirrors web/test/fallback.test.ts. */
class FallbackTest {
    @Test fun `main model answers`() = runTest {
        val calls = mutableListOf<String>()
        assertEquals("from main", withFallback("main", "lite") { calls += it; "from $it" })
        assertEquals(listOf("main"), calls)
    }

    @Test fun `falls back once when main fails`() = runTest {
        val calls = mutableListOf<String>()
        assertEquals("from lite", withFallback("main", "lite") { calls += it; if (it == "main") error("high demand") else "from $it" })
        assertEquals(listOf("main", "lite"), calls)
    }

    @Test fun `reports the main error when both fail`() = runTest {
        val e = runCatching { withFallback("main", "lite") { error("$it down") } }.exceptionOrNull()
        assertEquals("main down", e?.message)
    }

    @Test fun `no retry on the same model`() = runTest {
        val calls = mutableListOf<String>()
        runCatching { withFallback("main", "main") { calls += it; error("x") } }
        assertEquals(listOf("main"), calls)
    }
}

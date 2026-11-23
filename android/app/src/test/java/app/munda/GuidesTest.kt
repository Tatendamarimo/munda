package app.munda

import app.munda.domain.Crop
import app.munda.domain.Guides
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Contract every crop guide must meet, so new crops can't ship half-written. */
class GuidesTest {

    @Test fun `every crop has a complete guide`() {
        Crop.entries.forEach { crop ->
            val g = Guides.forCrop(crop)
            assertEquals(crop, g.crop)
            assertTrue("$crop guide too small", g.entries.size >= 5)
            assertEquals("$crop has duplicate ids", g.entries.size, g.entries.map { it.id }.toSet().size)
            g.entries.forEach { e ->
                assertTrue("${e.id}: needs keywords", e.keywords.isNotEmpty())
                assertTrue("${e.id}: keywords must be lower-case", e.keywords.all { it == it.lowercase() })
                assertTrue("${e.id}: needs signs, distinguish and a field check",
                    e.signs.isNotBlank() && e.distinguish.isNotBlank() && e.checkInField.isNotBlank())
                assertTrue("${e.id}: ids must be stable snake_case", e.id.matches(Regex("[a-z][a-z0-9_]*")))
            }
        }
    }
}

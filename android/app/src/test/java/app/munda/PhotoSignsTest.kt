package app.munda

import app.munda.data.inference.Prompts
import app.munda.domain.Crop
import app.munda.domain.ModelOutputParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Mirrors web/test/photo-signs.test.ts. */
class PhotoSignsTest {
    @Test fun `asks for visible signs only`() {
        val p = Prompts.photo(Crop.MAIZE)
        assertTrue(p.contains("only what you can see"))
        assertTrue(p.contains("Do not name a disease, pest or deficiency"))
        assertTrue(Prompts.photo(Crop.MAIZE, "Shona").contains("Write all text values in Shona"))
    }

    @Test fun `reads signs and clarity`() {
        val r = ModelOutputParser.parsePhotoSigns("""{"signs":"  Lower leaves yellow from the tip.  ","clear":true}""").getOrThrow()
        assertEquals("Lower leaves yellow from the tip.", r.signs); assertTrue(r.clear)
    }

    @Test fun `empty means unclear, long is capped, junk fails`() {
        assertFalse(ModelOutputParser.parsePhotoSigns("""{"signs":"","clear":true}""").getOrThrow().clear)
        assertEquals(300, ModelOutputParser.parsePhotoSigns("""{"signs":"${"x".repeat(900)}","clear":true}""").getOrThrow().signs.length)
        assertTrue(ModelOutputParser.parsePhotoSigns("nope").isFailure)
    }
}

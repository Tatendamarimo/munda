package app.munda

import app.munda.domain.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File

/** Mirrors web causeDisplay: guide-backed causes use the human-written guide in the farmer's language. */
class GuideTextTest {
    private val text = GuideText.load { name -> File("../../shared/guides/i18n/$name").takeIf { it.exists() }?.readText() }
    private val guide = Guides.forCrop(Crop.MAIZE)
    private val nitrogen = PossibleCause("nitrogen", "Nitrogen deficiency", Likelihood.HIGH, emptyList(), emptyList(), "Compare lower and upper leaves")

    @Test fun `english keeps the model's specific check`() {
        val d = text.causeDisplay(nitrogen, "en", guide)
        assertEquals(guide.get("nitrogen")!!.name, d.name)
        assertEquals("Compare lower and upper leaves", d.check)
        assertNull(d.modelCheck)
    }

    @Test fun `shona shows the guide's name and check, model's note kept`() {
        val d = text.causeDisplay(nitrogen, "sn", guide)
        assertEquals("Kushaya nitrogen", d.name)
        assertEquals("Compare lower and upper leaves", d.modelCheck)
    }

    @Test fun `causes outside the guide stay as written`() {
        val other = nitrogen.copy(guideId = null, name = "Something else", checkNext = "Look closely")
        assertEquals(CauseDisplay("Something else", "Look closely", null), text.causeDisplay(other, "sn", guide))
    }
}

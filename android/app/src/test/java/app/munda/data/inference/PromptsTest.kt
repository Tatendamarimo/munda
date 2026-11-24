package app.munda.data.inference

import app.munda.domain.*
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Mirrors web/test/prompts.test.ts: the cloud gets the farmer's language, on-device stays English. */
class PromptsTest {
    private val input = ObservationInput(Crop.MAIZE, "Low field", CropStage.EARLY_GROWTH, "Lower leaves yellow", CoreAnswers(), emptyList(), null)
    private val cands = Guides.forCrop(Crop.MAIZE).entries.take(3)

    @Test fun `cloud prompts carry the language`() {
        assertTrue(Prompts.record(input, cands, "Shona").contains("Write all text values in Shona"))
        assertTrue(Prompts.questions(input, cands, "French").contains("Write all text values in French"))
        assertTrue(Prompts.record(input, cands, "Shona").contains("Keep JSON keys, ids and enum values in English"))
    }

    @Test fun `nothing added for English or no language`() {
        assertFalse(Prompts.record(input, cands).contains("Write all text values"))
        assertFalse(Prompts.record(input, cands, "English").contains("Write all text values"))
    }

    @Test fun `doesn't-fit holds facts, not actions`() {
        assertTrue(Prompts.record(input, cands).contains("Never a check or an action"))
    }
}

package app.munda

import app.munda.data.GroupRepo
import org.junit.Assert.assertEquals
import org.junit.Test

/** Mirrors web/test/groups.test.ts. */
class GroupsTest {
    @Test fun `reads a code however it is typed`() {
        assertEquals("g-7KQ2MX", GroupRepo.normalizeCode(" 7kq2mx "))
        assertEquals("g-7KQ2MX", GroupRepo.normalizeCode("G-7KQ2MX"))
        assertEquals("g-7KQ2MX", GroupRepo.normalizeCode("7KQ 2MX"))
    }
    @Test fun `rounds to a square about 5 km wide`() {
        assertEquals("-18.60,31.55", GroupRepo.coarseCell(-18.6123, 31.5711))
        assertEquals("-18.65,31.60", GroupRepo.coarseCell(-18.6377, 31.5949))
    }
}

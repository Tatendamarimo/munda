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

    private fun fakeT(k: String, v: Array<Pair<String, Any>>): String {
        val tpl = mapOf("area.alertMessageOne" to "{problem} confirmed on a farm in {area}.", "area.alertMessage" to "{problem} confirmed on {n} farms in {area}.", "area.noArea" to "your area")[k]!!
        return v.fold(tpl) { acc, (name, value) -> acc.replace("{$name}", value.toString()) }
    }

    @Test fun `alert says a farm, not 1 farms`() {
        val a = app.munda.data.GroupAlert("x", "fall_armyworm", "Wedza", 1, "", 0)
        assertEquals("Fall armyworm confirmed on a farm in Wedza.", app.munda.data.alertText(::fakeT, { "Fall armyworm" }, a))
        assertEquals("Fall armyworm confirmed on 3 farms in your area.", app.munda.data.alertText(::fakeT, { "Fall armyworm" }, a.copy(count = 3, area = null)))
    }
}

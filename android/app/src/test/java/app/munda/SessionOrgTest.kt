package app.munda

import app.munda.data.Session
import org.junit.Assert.assertEquals
import org.junit.Test

/** Must match orgFor() in web/test/session.test.ts and myOrg() in firestore.rules. */
class SessionOrgTest {
    @Test fun farmerOnTheirOwnGetsAPrivateFarm() {
        assertEquals("u-abc123", Session.orgFor("abc123", null))
        assertEquals("u-abc123", Session.orgFor("abc123", ""))
    }

    @Test fun cooperativeMemberUsesTheAdminSetOrg() {
        assertEquals("wedza-coop", Session.orgFor("abc123", "wedza-coop"))
    }

    @Test fun movesPeopleOffTheOldSharedFarm() {
        assertEquals("u-abc123", Session.orgFor("abc123", "demo"))
    }
}

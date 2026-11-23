package app.munda

import app.munda.domain.LocalModelState
import app.munda.domain.Route
import app.munda.domain.RoutingPolicy
import org.junit.Assert.assertEquals
import org.junit.Test

class RoutingPolicyTest {
    private val max = 6000

    @Test fun `local model ready and short note runs on device even offline`() {
        assertEquals(Route.ON_DEVICE, RoutingPolicy.decide(500, LocalModelState.AVAILABLE, online = false, max).route)
    }

    @Test fun `local model ready and online still prefers device`() {
        assertEquals(Route.ON_DEVICE, RoutingPolicy.decide(500, LocalModelState.AVAILABLE, online = true, max).route)
    }

    @Test fun `long note goes to cloud when online`() {
        assertEquals(Route.CLOUD, RoutingPolicy.decide(max + 1, LocalModelState.AVAILABLE, online = true, max).route)
    }

    @Test fun `long note offline is queued, never truncated`() {
        assertEquals(Route.QUEUE_UNTIL_ONLINE, RoutingPolicy.decide(max + 1, LocalModelState.AVAILABLE, online = false, max).route)
    }

    @Test fun `no local model online uses cloud`() {
        assertEquals(Route.CLOUD, RoutingPolicy.decide(100, LocalModelState.UNAVAILABLE, online = true, max).route)
    }

    @Test fun `no local model offline is queued`() {
        assertEquals(Route.QUEUE_UNTIL_ONLINE, RoutingPolicy.decide(100, LocalModelState.DOWNLOADING, online = false, max).route)
    }

    @Test fun `exactly at limit stays on device`() {
        assertEquals(Route.ON_DEVICE, RoutingPolicy.decide(max, LocalModelState.AVAILABLE, online = false, max).route)
    }
}

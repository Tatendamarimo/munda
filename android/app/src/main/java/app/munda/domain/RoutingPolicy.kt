package app.munda.domain

/** Availability of the on-device model, mirrored from the SDK so the policy stays pure. */
enum class LocalModelState { AVAILABLE, DOWNLOADING, DOWNLOADABLE, UNAVAILABLE, UNKNOWN }

enum class Route {
    /** Hybrid model in PREFER_ON_DEVICE mode: Nano runs it; cloud only if Nano errors and we're online. */
    ON_DEVICE,
    /** Input exceeds what Nano accepts, or Nano isn't on this phone; go straight to cloud. */
    CLOUD,
    /** No usable local model and no signal: save the raw transcript now, structure on reconnect. */
    QUEUE_UNTIL_ONLINE,
}

data class RouteDecision(val route: Route, val reason: String)

/**
 * Decides where an inspection is structured. Custom routing on top of the SDK's hybrid mode so
 * that (a) inputs too large for Nano never get silently truncated and (b) the user is told,
 * before they tap, whether the report will stay on the phone.
 */
object RoutingPolicy {

    fun decide(
        transcriptChars: Int,
        localModel: LocalModelState,
        online: Boolean,
        maxOnDeviceChars: Int,
    ): RouteDecision {
        val fitsOnDevice = transcriptChars <= maxOnDeviceChars
        val localReady = localModel == LocalModelState.AVAILABLE

        return when {
            localReady && fitsOnDevice ->
                RouteDecision(Route.ON_DEVICE, "Runs on this device. Private, and works without signal.")
            online && !fitsOnDevice ->
                RouteDecision(Route.CLOUD, "Runs in the cloud. This note is too long for the on-device model.")
            online ->
                RouteDecision(Route.CLOUD, "Runs in the cloud. The on-device model is ${localModel.describe()}.")
            !fitsOnDevice ->
                RouteDecision(Route.QUEUE_UNTIL_ONLINE, "Saves now. This long note is finished when you’re back online.")
            else ->
                RouteDecision(Route.QUEUE_UNTIL_ONLINE, "Saves now. Munda finishes it when you’re back online.")
        }
    }

    private fun LocalModelState.describe() = when (this) {
        LocalModelState.DOWNLOADING -> "still downloading"
        LocalModelState.DOWNLOADABLE -> "not downloaded yet"
        LocalModelState.UNAVAILABLE -> "not supported on this device"
        LocalModelState.UNKNOWN -> "still being checked"
        LocalModelState.AVAILABLE -> "ready"
    }
}

package app.munda.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat

/** Foreground, one-shot approximate location. No permission prompt until the farmer taps. */
@Composable
fun LocationButton(vm: FarmViewModel) {
    val context = LocalContext.current
    val s = strings()
    var busy by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf<String?>(null) }
    val manager = remember { context.getSystemService(Context.LOCATION_SERVICE) as LocationManager }
    val handler = remember { Handler(Looper.getMainLooper()) }
    var listener by remember { mutableStateOf<LocationListener?>(null) }
    var timeout by remember { mutableStateOf<Runnable?>(null) }
    fun cleanup() { listener?.let { manager.removeUpdates(it) }; listener = null; timeout?.let { handler.removeCallbacks(it) }; timeout = null }
    fun locate() {
        busy = true; notice = null
        val callback = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                cleanup(); vm.useDeviceArea(location.latitude, location.longitude); busy = false; notice = "selected"
            }
            @Deprecated("Legacy Android callback") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
            override fun onProviderEnabled(provider: String) = Unit
            override fun onProviderDisabled(provider: String) { cleanup(); busy = false; notice = "failed" }
        }
        try {
            if (!manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) { busy = false; notice = "failed"; return }
            listener = callback
            val expired = Runnable { cleanup(); busy = false; notice = "failed" }
            timeout = expired; handler.postDelayed(expired, 15000)
            @Suppress("DEPRECATION")
            manager.requestSingleUpdate(LocationManager.NETWORK_PROVIDER, callback, Looper.getMainLooper())
        } catch (_: SecurityException) { cleanup(); busy = false; notice = "denied" }
          catch (_: Exception) { cleanup(); busy = false; notice = "failed" }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { allowed -> if (allowed) locate() else { busy = false; notice = "denied" } }
    DisposableEffect(Unit) { onDispose { cleanup() } }
    Text(s.t("location.help"), style = androidx.compose.material3.MaterialTheme.typography.bodySmall, color = LocalMunda.current.ink2)
    MainButton(s.t(if (busy) "location.finding" else "location.use"), {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) locate()
        else { busy = true; permission.launch(Manifest.permission.ACCESS_COARSE_LOCATION) }
    }, enabled = !busy, kind = ButtonKind.GHOST)
    notice?.let { Text(s.t("location.$it"), style = androidx.compose.material3.MaterialTheme.typography.bodySmall) }
}

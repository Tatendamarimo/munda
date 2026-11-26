package app.munda.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.VolumeUp
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch

val LocalVoice = staticCompositionLocalOf<app.munda.data.Voice?> { null }
val LocalOnline = staticCompositionLocalOf { true }

/** Reads the screen's main text in the farmer's language; hidden when no voice can (web: ReadAloud). */
@Composable
fun ReadAloud(text: String) {
    val voice = LocalVoice.current ?: return
    val s = strings()
    val online = LocalOnline.current
    val locale = s.i18n.info(s.lang).locale
    if (text.isBlank() || (!online && !voice.deviceCanSpeak(locale))) { androidx.compose.foundation.layout.Spacer(Modifier.size(44.dp)); return }
    var state by remember { mutableStateOf("idle") }
    val scope = rememberCoroutineScope()
    var playback by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }
    DisposableEffect(text, locale) { onDispose { playback?.cancel(); voice.stop(); state = "idle" } }
    val c = LocalMunda.current
    IconButton(
        onClick = {
            if (state != "idle") { playback?.cancel(); voice.stop(); state = "idle"; return@IconButton }
            state = "loading"
            playback = scope.launch { voice.speak(text, locale, onStarted = { state = "playing" }) { state = "idle" } }
        },
        modifier = Modifier.size(44.dp).clip(CircleShape).background(c.forest),
    ) {
        when (state) {
            "loading" -> CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
            "playing" -> Icon(Icons.Outlined.Stop, s.t("readAloud.stop"), tint = Color.White)
            else -> Icon(Icons.AutoMirrored.Outlined.VolumeUp, s.t("readAloud.play"), tint = Color.White)
        }
    }
}

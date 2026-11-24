package app.munda.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.munda.data.GroupAlert
import app.munda.data.alertText
import app.munda.domain.MaizeGuide

/** Join a cooperative or extension group with the officer's code (web: GroupCard). Officers start groups on the web. */
@Composable
fun GroupCard(vm: FarmViewModel) {
    val c = LocalMunda.current
    val s = strings()
    val g by vm.group.collectAsStateWithLifecycle()
    val problem by vm.groupProblem.collectAsStateWithLifecycle()
    var code by remember { mutableStateOf("") }
    // Alerts arrive as notifications; Android 13+ asks once, when the farmer joins.
    val askNotify = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    CardBox {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Outlined.Groups, null, tint = c.leaf)
            Text(s.t("group.title"), style = MaterialTheme.typography.titleSmall)
        }
        val joined = g
        if (joined != null) {
            Text(s.t(if (joined.role == "officer") "group.officer" else "group.member", "name" to joined.name), style = MaterialTheme.typography.bodyMedium)
            MainButton(s.t("group.leave"), { vm.leaveGroup() }, kind = ButtonKind.GHOST)
        } else {
            Text(s.t("group.help"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
            OutlinedTextField(code, { code = it.take(12) }, Modifier.fillMaxWidth(), placeholder = { Text(s.t("group.codePlaceholder")) }, singleLine = true)
            MainButton(s.t("group.join"), {
                if (Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
                vm.joinGroup(code)
            }, enabled = code.isNotBlank())
            problem?.let { Text(s.t(it), style = MaterialTheme.typography.bodySmall, color = c.alert) }
            Text(s.t("group.needsSignal"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
        }
    }
}

/** The newest alert the group's officer confirmed (web: GroupAlertCard). */
@Composable
fun GroupAlertCard(a: GroupAlert, vm: FarmViewModel) {
    val c = LocalMunda.current
    val s = strings()
    val text = alertText({ k, v -> s.t(k, *v) }, { id -> MaizeGuide.get(id)?.let { vm.c.guideText.localized(it, s.lang).name } ?: id }, a)
    Row(
        Modifier.offset(y = (-22).dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(c.leafWash).padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Icon(Icons.Outlined.Campaign, null, tint = c.leaf)
        Column {
            Text(listOfNotNull(s.t("home.groupAlert"), a.area).joinToString(" · "), style = MaterialTheme.typography.titleSmall)
            Text(text, style = MaterialTheme.typography.bodySmall, color = c.ink2)
        }
    }
}

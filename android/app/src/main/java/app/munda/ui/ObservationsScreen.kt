package app.munda.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Grass
import androidx.compose.material.icons.outlined.Wifi
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.munda.AppContainer
import app.munda.data.ObservationItem
import app.munda.data.SessionState
import app.munda.data.inference.LocalModelInfo
import app.munda.domain.InferenceOrigin
import app.munda.domain.Likelihood
import app.munda.domain.LocalModelState
import app.munda.domain.PossibleCause
import app.munda.domain.ReviewStatus
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@OptIn(ExperimentalCoroutinesApi::class)
class ObservationsViewModel(private val c: AppContainer) : ViewModel() {
    val session: StateFlow<SessionState> = c.session.state
    val online: StateFlow<Boolean> = c.connectivity.online
    val localModel: StateFlow<LocalModelInfo> = c.ai.localModel
    private val scheduled = mutableSetOf<String>()

    val items: StateFlow<List<ObservationItem>?> = c.session.state
        .flatMapLatest { s -> if (s is SessionState.Ready) c.repository.observeRecent(s.orgId) else emptyFlow() }
        .onEach(::reconcileBackgroundWork)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    init {
        viewModelScope.launch { if (c.session.ready != null) c.ai.ensureLocalModel() else c.ai.refreshLocalStatus() }
    }

    fun activate() = viewModelScope.launch {
        c.session.activate()
        if (c.session.ready != null) c.ai.ensureLocalModel()
    }

    fun downloadModel() = viewModelScope.launch { c.ai.ensureLocalModel() }

    /** Self-healing: re-enqueue work lost to process death. Unique-work KEEP makes it idempotent. */
    private fun reconcileBackgroundWork(items: List<ObservationItem>) {
        val uid = c.session.ready?.uid ?: return
        items.map { it.observation }.filter { it.ownerUid == uid }.forEach { o ->
            if (!scheduled.add("${o.id}:${o.origin}:${o.reviewStatus}")) return@forEach
            when {
                o.origin == InferenceOrigin.PENDING && o.recordError == null -> c.scheduler.buildRecordWhenOnline(o.orgId, o.id)
                o.record != null && o.reviewStatus == ReviewStatus.NOT_STARTED -> c.scheduler.reviewWhenOnline(o.orgId, o.id)
            }
        }
    }
}

@Composable
fun ObservationsScreen(vm: ObservationsViewModel, onNew: () -> Unit, onOpen: (String) -> Unit) {
    val session by vm.session.collectAsStateWithLifecycle()
    val online by vm.online.collectAsStateWithLifecycle()
    val local by vm.localModel.collectAsStateWithLifecycle()
    val items by vm.items.collectAsStateWithLifecycle()
    val c = LocalMunda.current

    if (session !is SessionState.Ready) {
        Welcome(session, online, onActivate = { vm.activate() })
        return
    }

    Scaffold(
        containerColor = c.paper,
        topBar = { AppBar(online, local, onDownload = { vm.downloadModel() }) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNew, containerColor = c.leaf, contentColor = c.onLeaf, shape = RoundedCornerShape(16.dp),
                icon = { Icon(Icons.Outlined.Add, null) }, text = { Text("New observation", style = MaterialTheme.typography.labelLarge) },
            )
        },
    ) { pad ->
        LazyColumn(Modifier.fillMaxSize().padding(pad), contentPadding = PaddingValues(bottom = 104.dp)) {
            item {
                Text("Observations", style = MaterialTheme.typography.titleLarge, color = c.ink, modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 10.dp))
                HorizontalDivider(color = c.rule)
            }
            val list = items
            when {
                list == null -> item { Box(Modifier.padding(20.dp)) { Working("Loading your observations") } }
                list.isEmpty() -> item {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(Icons.Outlined.Grass, null, tint = c.ink2, modifier = Modifier.size(28.dp))
                        Text("No observations yet. Walk your maize and record what you see. Munda works without signal.", style = MaterialTheme.typography.bodyMedium, color = c.ink2)
                    }
                }
                else -> items(list, key = { it.observation.id }) { ObservationRow(it, onClick = { onOpen(it.observation.id) }) }
            }
        }
    }
}

@Composable
private fun AppBar(online: Boolean, local: LocalModelInfo, onDownload: () -> Unit) {
    val c = LocalMunda.current
    Surface(color = c.paper) {
        Column(Modifier.statusBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Wordmark()
                Spacer(Modifier.weight(1f))
                StatusMenu(online, local, onDownload)
            }
            HorizontalDivider(color = c.rule)
        }
    }
}

/** Compact connection + offline-AI status; opens to explain and to retry the model download. */
@Composable
private fun StatusMenu(online: Boolean, local: LocalModelInfo, onDownload: () -> Unit) {
    val c = LocalMunda.current
    var open by remember { mutableStateOf(false) }
    val (text, dot) = when (local.state) {
        LocalModelState.AVAILABLE -> "Offline AI ready" to androidx.compose.ui.graphics.Color(0xFF2E8B57)
        LocalModelState.DOWNLOADING -> ("Downloading AI" + (local.downloadProgress?.let { " ${(it * 100).toInt()}%" } ?: "")) to c.ruleStrong
        LocalModelState.DOWNLOADABLE -> "Offline AI not downloaded" to c.kernelDeep
        LocalModelState.UNAVAILABLE -> "Cloud AI only" to c.sky
        LocalModelState.UNKNOWN -> "Checking AI" to c.ruleStrong
    }
    Box {
        Surface(
            onClick = { open = true }, shape = RoundedCornerShape(50), color = c.paper, border = BorderStroke(1.dp, c.rule),
            modifier = Modifier.heightIn(min = 40.dp),
        ) {
            Row(Modifier.padding(horizontal = 12.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(if (online) Icons.Outlined.Wifi else Icons.Outlined.WifiOff, null, Modifier.size(16.dp).semantics { contentDescription = if (online) "Online" else "No signal" }, tint = c.ink)
                Box(Modifier.size(8.dp).clip(CircleShape).background(dot))
                Text(text, style = MaterialTheme.typography.bodySmall, color = c.ink)
            }
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }, containerColor = c.paper) {
            Column(Modifier.width(300.dp).padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    if (online) "You’re online. Records sync and get a history review." else "No signal. Records are saved on this phone and sync later.",
                    style = MaterialTheme.typography.bodySmall, color = c.ink,
                )
                Text(
                    when (local.state) {
                        LocalModelState.AVAILABLE -> "Munda’s questions and field records run on this phone, without signal."
                        LocalModelState.UNAVAILABLE -> "This phone can’t run AI offline. Offline, Munda saves observations and finishes them when you’re back online."
                        else -> "Download the offline AI before you go to the field, so Munda works without signal."
                    },
                    style = MaterialTheme.typography.bodySmall, color = c.ink2,
                )
                if (local.state == LocalModelState.DOWNLOADING) {
                    val p = local.downloadProgress
                    if (p != null) LinearProgressIndicator(progress = { p }, modifier = Modifier.fillMaxWidth(), color = c.leaf) else LinearProgressIndicator(Modifier.fillMaxWidth(), color = c.leaf)
                }
                if (local.state == LocalModelState.DOWNLOADABLE) {
                    OutlinedButton(onClick = onDownload, enabled = online, border = BorderStroke(1.5.dp, c.leaf)) {
                        Icon(Icons.Outlined.Download, null, tint = c.leaf); Spacer(Modifier.width(8.dp)); Text("Download offline AI", color = c.leaf)
                    }
                }
            }
        }
    }
}

@Composable
private fun ObservationRow(item: ObservationItem, onClick: () -> Unit) {
    val c = LocalMunda.current
    val o = item.observation
    val top = o.record?.possibleCauses?.firstOrNull()
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 20.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(o.plot, style = MaterialTheme.typography.titleMedium, color = c.ink, modifier = Modifier.weight(1f))
            Text(relativeTime(o.createdAtMillis), style = MaterialTheme.typography.labelSmall, color = c.ink2)
        }
        Text(o.record?.summary ?: o.description, style = MaterialTheme.typography.bodyMedium, color = c.ink2, maxLines = 2, overflow = TextOverflow.Ellipsis)
        if (top != null) Text("${top.likelihood.label}: ${top.name}", style = MaterialTheme.typography.labelLarge, color = c.likelihood(top.likelihood))
        Box(Modifier.padding(top = 4.dp)) {
            Badges {
                o.record?.let { UrgencyBadge(it.urgency) }
                OriginBadge(o.origin)
                SyncBadge(item.synced)
            }
        }
    }
    HorizontalDivider(color = c.rule)
}

/** First run. The hero is the product's own output: a real possible-cause entry. */
@Composable
private fun Welcome(state: SessionState, online: Boolean, onActivate: () -> Unit) {
    val c = LocalMunda.current
    Column(Modifier.fillMaxSize().background(c.mist).verticalScroll(rememberScrollState())) {
        Surface(color = c.paper) {
            Column(Modifier.statusBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp)) { Wordmark() }
                HorizontalDivider(color = c.rule)
            }
        }
        Column(Modifier.padding(horizontal = 20.dp, vertical = 32.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(22.dp)) {
            Text("Know what to check next in your maize field.", style = MaterialTheme.typography.headlineLarge)
            Text(
                "Describe what you see. Munda asks a few questions, then shows the possible causes, how sure it is about each, and what to check before you spend money. It works without signal.",
                style = MaterialTheme.typography.bodyLarge, color = c.ink,
            )
            when (state) {
                SessionState.Loading, SessionState.Activating -> Working("Setting up this phone")
                is SessionState.Error -> Text(state.message, color = c.alert, style = MaterialTheme.typography.bodyMedium)
                else -> Unit
            }
            Button(
                onClick = onActivate, enabled = online && state !is SessionState.Activating,
                colors = ButtonDefaults.buttonColors(containerColor = c.leaf, contentColor = c.onLeaf),
                shape = RoundedCornerShape(12.dp), modifier = Modifier.heightIn(min = 56.dp),
            ) { Text(if (online) "Set up this phone" else "Connect to the internet to set up", style = MaterialTheme.typography.labelLarge) }
            Text("Setup needs signal once. After that, Munda works offline. Photos never leave your phone.", style = MaterialTheme.typography.bodySmall, color = c.ink2)
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(c.leafWash).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Lower leaves yellowing from the tip after heavy rain.", style = MaterialTheme.typography.bodySmall, color = c.ink2, modifier = Modifier.weight(1f).padding(end = 12.dp))
                    OriginBadge(InferenceOrigin.ON_DEVICE)
                }
                CauseEntry(
                    PossibleCause(
                        guideId = "nitrogen", name = "Nitrogen deficiency", likelihood = Likelihood.HIGH,
                        supporting = listOf("Lower leaves yellow first", "Yellowing runs from the tip down the middle"),
                        againstOrMissing = listOf("No record of fertilizer this season"),
                        checkNext = "Compare with a row that was top-dressed.",
                    ),
                    animate = true,
                )
            }
        }
    }
}

private fun relativeTime(ms: Long): String {
    val min = (System.currentTimeMillis() - ms) / 60_000
    return when {
        min < 1 -> "Just now"
        min < 60 -> "$min min ago"
        min < 60 * 24 -> "${min / 60} h ago"
        else -> DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(ms))
    }
}

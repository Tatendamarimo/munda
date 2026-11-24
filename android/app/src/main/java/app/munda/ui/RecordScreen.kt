package app.munda.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.History
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.munda.data.ObservationItem
import app.munda.data.SessionState
import app.munda.domain.*
import kotlinx.coroutines.flow.emptyFlow

/** One saved record: where the AI worked, the causes, the cloud history review, what was recorded (web: RecordPage). */
@Composable
fun RecordScreen(farm: FarmViewModel, id: String, onBack: () -> Unit, onPlot: (String) -> Unit) {
    val c = LocalMunda.current
    val s = strings()
    val session by farm.session.collectAsStateWithLifecycle()
    val orgId = (session as? SessionState.Ready)?.orgId
    val item by remember(orgId, id) { if (orgId != null) farm.c.repository.observe(orgId, id) else emptyFlow<ObservationItem?>() }
        .collectAsStateWithLifecycle(initialValue = null)
    val it = item
    if (it == null) {
        Column { PageHead(onBack = onBack); Box(Modifier.padding(16.dp)) { Working(s.t("record.loading")) } }
        return
    }
    val o = it.observation
    val guide = Guides.forCrop(o.crop)
    val display: (PossibleCause) -> CauseDisplay = { cause -> farm.c.guideText.causeDisplay(cause, s.lang, guide) }
    Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        val lead = o.record?.possibleCauses?.firstOrNull()?.let(display)
        PageHead(o.plot, onBack, right = { ReadAloud(lead?.let { d -> listOf(s.t("result.title"), d.name, s.t("result.checkFirst"), d.check).joinToString(". ") }.orEmpty()) })
        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                SyncBadge(it.synced)
                Text(s.date(o.createdAtMillis), style = MaterialTheme.typography.labelSmall, color = c.ink2)
            }
            HybridTrail(o, it.synced)
            when {
                o.record != null -> {
                    RecordHeader(o.record, o.origin)
                    CauseList(o.record.possibleCauses, display)
                    Details(o.record)
                }
                o.recordError != null -> Text(s.t("record.error", "error" to o.recordError), color = c.alert)
                else -> CardBox { QueuedBadge(); Text(s.t("record.queued")) }
            }
            CardBox {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.History, null, tint = c.leaf); Text(s.t("record.review"), style = MaterialTheme.typography.titleMedium)
                }
                val review = o.review
                when {
                    o.record == null -> Text(s.t("record.reviewAfterRecord"), color = c.ink2)
                    o.reviewStatus == ReviewStatus.NOT_STARTED -> Text(s.t("record.reviewPending"), color = c.ink2)
                    o.reviewStatus == ReviewStatus.FAILED -> Text(s.t("record.reviewFailed"), color = c.alert)
                    review != null -> {
                        if (review.patterns.isNotEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            review.patterns.forEach { p -> Badge(s.pattern(p.kind), c.rust, c.rustWash) }
                        }
                        Text(review.summary, style = MaterialTheme.typography.bodyLarge)
                        review.patterns.forEach { p -> Text("• ${p.summary} (${s.source(p.source)})", style = MaterialTheme.typography.bodySmall, color = c.ink2) }
                        Text(s.t("record.basedOn", "n" to review.historyConsidered), style = MaterialTheme.typography.bodySmall, color = c.ink2)
                        if (review.nextChecks.isNotEmpty()) {
                            Tag(s.t("record.nextChecks"))
                            review.nextChecks.forEachIndexed { i, check -> Text("${i + 1}. $check", style = MaterialTheme.typography.bodyMedium) }
                        }
                        if (review.updatedCauses.isNotEmpty()) {
                            Tag(s.t("record.causesWithHistory"))
                            CauseList(review.updatedCauses, display)
                        }
                    }
                }
            }
            CardBox {
                Text(s.t("record.whatRecorded"), style = MaterialTheme.typography.titleMedium)
                @Composable fun Fact(k: String, v: String) = Row { Text(k, Modifier.weight(1f), color = c.ink2, style = MaterialTheme.typography.bodyMedium); Text(v, Modifier.weight(1.4f), style = MaterialTheme.typography.bodyMedium) }
                Fact(s.t("record.crop"), "${s.t("home.cropLine")}, ${s.stage(o.cropStage).lowercase()}")
                Fact(s.t("record.affected"), s.area(o.core.area))
                Fact(s.t("record.rain"), s.rain(o.core.rainfall))
                Fact(s.t("record.noticed"), s.onset(o.core.onset))
                Text("“${o.description}”", style = MaterialTheme.typography.bodyMedium.copy(fontStyle = FontStyle.Italic))
                o.followUps.forEach { qa -> Text("${qa.question} — ${qa.answer}", style = MaterialTheme.typography.bodySmall, color = c.ink2) }
                if (o.hadPhoto) Text(s.t("record.photoNote"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
                Text("${s.t("plots.history")} · ${o.plot}", Modifier.clickable { onPlot(o.plotKey) }, style = MaterialTheme.typography.labelMedium, color = c.leaf)
            }
            CallOfficer(farm)
        }
    }
}

/** First open: one tap while online sets up this device (anonymous, no password). */
@Composable
fun WelcomeScreen(farm: FarmViewModel) {
    val c = LocalMunda.current
    val s = strings()
    val session by farm.session.collectAsStateWithLifecycle()
    val online by farm.online.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Hero(right = {}, meta = null) {
            Text(s.t("welcome.title"), style = MaterialTheme.typography.headlineMedium, color = androidx.compose.ui.graphics.Color.White)
        }
        Column(Modifier.padding(16.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            @OptIn(ExperimentalLayoutApi::class)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                s.i18n.langs.forEach { l ->
                    val on = l.code == s.lang
                    Text(l.native, Modifier.clip(RoundedCornerShape(50)).background(if (on) c.forest else c.card).clickable { farm.setLanguage(l.code) }
                        .padding(horizontal = 12.dp, vertical = 7.dp), style = MaterialTheme.typography.labelMedium, color = if (on) androidx.compose.ui.graphics.Color.White else c.ink)
                }
            }
            Text(s.t("welcome.lede"), style = MaterialTheme.typography.bodyLarge)
            when (val st = session) {
                SessionState.Loading, SessionState.Activating -> Working(s.t("welcome.settingUp"))
                is SessionState.Error -> Text(st.message, color = c.alert)
                else -> Unit
            }
            MainButton(s.t(if (online) "welcome.setup" else "welcome.setupOffline"), { farm.activate() }, enabled = online && session !is SessionState.Activating)
            Text(s.t("welcome.fineprint"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
        }
    }
}

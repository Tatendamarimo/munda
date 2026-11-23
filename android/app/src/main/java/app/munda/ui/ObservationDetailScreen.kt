package app.munda.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.History
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.munda.AppContainer
import app.munda.data.ObservationItem
import app.munda.domain.FindingSource
import app.munda.domain.ReviewStatus
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.stateIn
import java.text.DateFormat
import java.util.Date

class ObservationDetailViewModel(c: AppContainer, id: String) : ViewModel() {
    val item: StateFlow<ObservationItem?> = (c.session.ready?.let { c.repository.observe(it.orgId, id) } ?: emptyFlow())
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)
}

@Composable
fun ObservationDetailScreen(vm: ObservationDetailViewModel, onBack: () -> Unit) {
    val item by vm.item.collectAsStateWithLifecycle()
    val c = LocalMunda.current
    Column(Modifier.fillMaxSize().background(c.mist).statusBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 12.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        val current = item
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back", tint = c.ink) }
            if (current != null) Badges {
                current.observation.record?.let { UrgencyBadge(it.urgency) }
                OriginBadge(current.observation.origin)
                SyncBadge(current.synced)
            }
        }
        if (current == null) { Working("Loading observation"); return@Column }
        val o = current.observation

        Text(o.plot, style = MaterialTheme.typography.headlineMedium, color = c.ink)
        Facts(
            listOf(
                "Recorded" to DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(o.createdAtMillis)),
                "Crop" to "${o.crop.label}, ${o.cropStage.label.lowercase()}",
                "Affected" to o.core.area.label,
                "Rain, last 2 weeks" to o.core.rainfall.label,
                "First noticed" to o.core.onset.label,
            ),
        )

        val rec = o.record
        if (rec != null) {
            Text(rec.summary, style = MaterialTheme.typography.titleLarge, color = c.ink)
            UncertaintyNote(rec.uncertaintyNote)
            SectionTitle("Possible causes")
            rec.possibleCauses.forEach { CauseEntry(it) }
        } else if (o.recordError != null) {
            Text("Munda couldn’t write this record: ${o.recordError}", color = c.alert, style = MaterialTheme.typography.bodyMedium)
        } else {
            QueuedBadge()
            Text("Munda writes the field record when this phone is back online.", style = MaterialTheme.typography.bodyMedium, color = c.ink)
        }

        SectionTitle("History review", history = true)
        val review = o.review
        when {
            rec == null -> Muted("Runs after the field record is written.")
            o.reviewStatus == ReviewStatus.NOT_STARTED -> Muted("When you’re online, Munda compares this record with earlier ones from this plot and your other plots.")
            o.reviewStatus == ReviewStatus.FAILED -> Text("The review didn’t complete. Your record is saved.", color = c.alert, style = MaterialTheme.typography.bodyMedium)
            review != null -> {
                Text(review.summary, style = MaterialTheme.typography.bodyLarge, color = c.ink)
                Muted("Based on ${review.historyConsidered} earlier ${if (review.historyConsidered == 1) "record" else "records"}.")
                review.patterns.forEach { p ->
                    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min).clip(RoundedCornerShape(8.dp)).background(c.paper).border(1.dp, c.rule, RoundedCornerShape(8.dp))) {
                        Box(Modifier.width(3.dp).fillMaxHeight().background(c.sky))
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Badges {
                                Badge(p.kind.label, c.sky, c.skyWash)
                                Badge(if (p.source == FindingSource.RULE) "From your records" else "Cloud AI", c.ink2, c.ink2.copy(alpha = .12f))
                            }
                            Text(p.summary, style = MaterialTheme.typography.bodyMedium, color = c.ink)
                        }
                    }
                }
                if (review.nextChecks.isNotEmpty()) {
                    Text("What to check next", style = MaterialTheme.typography.titleMedium, color = c.ink)
                    review.nextChecks.forEachIndexed { i, check ->
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("${i + 1}.", style = MaterialTheme.typography.titleSmall, color = c.leaf)
                            Text(check, style = MaterialTheme.typography.bodyMedium, color = c.ink)
                        }
                    }
                }
                if (review.updatedCauses.isNotEmpty()) {
                    Text("Possible causes, with history", style = MaterialTheme.typography.titleMedium, color = c.ink)
                    review.updatedCauses.forEach { CauseEntry(it) }
                }
            }
        }

        SectionTitle("What was recorded")
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min).background(c.paper)) {
            Box(Modifier.width(3.dp).fillMaxHeight().background(c.ruleStrong))
            Text(o.description, style = MaterialTheme.typography.bodyMedium, color = c.ink, modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp))
        }
        o.followUps.forEach { qa ->
            Column {
                Text(qa.question, style = MaterialTheme.typography.bodySmall, color = c.ink2)
                Text(qa.answer, style = MaterialTheme.typography.titleSmall, color = c.ink)
            }
        }
        if (o.hadPhoto) Muted("A leaf photo was used for this record. Photos aren’t uploaded.")
    }
}

@Composable
private fun Facts(facts: List<Pair<String, String>>) {
    val c = LocalMunda.current
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.paper).border(1.dp, c.rule, RoundedCornerShape(12.dp))) {
        facts.chunked(2).forEachIndexed { r, row ->
            if (r > 0) HorizontalDivider(color = c.rule)
            Row(Modifier.height(IntrinsicSize.Min)) {
                row.forEachIndexed { i, (label, value) ->
                    if (i > 0) Box(Modifier.width(1.dp).fillMaxHeight().background(c.rule))
                    Column(Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 10.dp)) {
                        Text(label, style = MaterialTheme.typography.labelSmall, color = c.ink2)
                        Text(value, style = MaterialTheme.typography.titleSmall, color = c.ink)
                    }
                }
                if (row.size == 1) Box(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String, history: Boolean = false) {
    val c = LocalMunda.current
    Column(verticalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.padding(top = 6.dp)) {
        HorizontalDivider(color = c.rule)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (history) Icon(Icons.Outlined.History, null, tint = c.sky, modifier = Modifier.size(20.dp))
            Text(text, style = MaterialTheme.typography.titleLarge, color = c.ink)
        }
    }
}

@Composable
private fun Muted(text: String) = Text(text, style = MaterialTheme.typography.bodyMedium, color = LocalMunda.current.ink2)

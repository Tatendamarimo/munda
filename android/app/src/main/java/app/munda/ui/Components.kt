package app.munda.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.SdStorage
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.munda.R
import app.munda.domain.InferenceOrigin
import app.munda.domain.Likelihood
import app.munda.domain.PossibleCause
import app.munda.domain.Urgency
import android.provider.Settings

// ---------- Brand ----------

/** The Munda logo as designed (docs/brand/munda-logo.svg): symbol and wordmark. */
@Composable
fun Wordmark(modifier: Modifier = Modifier) {
    Row(modifier.semantics { contentDescription = "Munda" }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Image(painterResource(R.drawable.munda_symbol), contentDescription = null, modifier = Modifier.size(34.dp))
        Image(painterResource(R.drawable.munda_wordmark), contentDescription = null, modifier = Modifier.height(22.dp).width(80.dp))
    }
}

// ---------- Badges ----------

@Composable
fun Badge(text: String, fg: Color, bg: Color, icon: ImageVector? = null) {
    Surface(shape = RoundedCornerShape(6.dp), color = bg, contentColor = fg) {
        Row(Modifier.heightIn(min = 26.dp).padding(horizontal = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            if (icon != null) Icon(icon, null, Modifier.size(14.dp))
            Text(text, style = MaterialTheme.typography.labelMedium)
        }
    }
}

/** Where the AI actually ran, from the SDK's inferenceSource. Shown on every record. */
@Composable
fun OriginBadge(origin: InferenceOrigin) {
    val c = LocalMunda.current
    when (origin) {
        InferenceOrigin.ON_DEVICE -> Badge(strings().origin(origin), c.leaf, c.leafWash, Icons.Outlined.PhoneAndroid)
        InferenceOrigin.CLOUD -> Badge(strings().origin(origin), c.sky, c.skyWash, Icons.Outlined.Cloud)
        InferenceOrigin.PENDING -> Badge(strings().origin(origin), c.ink2, c.ink2.copy(alpha = .12f), Icons.Outlined.Timer)
    }
}

@Composable
fun SyncBadge(synced: Boolean) {
    val c = LocalMunda.current
    if (synced) Badge(strings().t("enums.sync.SYNCED"), c.leaf, c.leafWash, Icons.Outlined.CheckCircle)
    else Badge(strings().t("enums.sync.LOCAL"), c.soil, c.soilWash, Icons.Outlined.SdStorage)
}

@Composable
fun UrgencyBadge(u: Urgency) {
    val (fg, bg) = LocalMunda.current.urgency(u)
    Badge(strings().urgency(u), fg, bg)
}

@Composable
fun QueuedBadge() {
    val c = LocalMunda.current
    Badge(strings().t("enums.sync.QUEUED"), c.ink2, c.ink2.copy(alpha = .12f), Icons.Outlined.CloudUpload)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun Badges(content: @Composable () -> Unit) =
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { content() }

// ---------- Kernel meter: the signature element ----------

private val kernelPath = PathParser().parsePathString("M5 .8C8 .8 9.4 4 9.4 7.6 9.4 11 7.4 13.2 5 13.2S.6 11 .6 7.6C.6 4 2 .8 5 .8Z").toPath()
private const val KERNELS = 5

/**
 * Likelihood as maize kernels. "Likely" fills four of five, never five: Munda never claims
 * certainty. Words sit beside it so colour isn't needed. Animates once on reveal unless the
 * system has animations turned off.
 */
@Composable
fun KernelMeter(likelihood: Likelihood, animate: Boolean = false) {
    val c = LocalMunda.current
    val filled = when (likelihood) { Likelihood.LOW -> 1; Likelihood.MEDIUM -> 3; Likelihood.HIGH -> 4 }
    val context = LocalContext.current
    val reduceMotion = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    val progress = remember { Animatable(if (animate && !reduceMotion) 0f else 1f) }
    LaunchedEffect(Unit) { if (progress.value < 1f) progress.animateTo(1f, tween(650)) }
    val fill = if (likelihood == Likelihood.HIGH) c.kernel else c.kernel.copy(alpha = .7f).compositeOver(c.kernelEmpty)
    val label = strings().likelihood(likelihood)

    Column(
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.semantics { contentDescription = "${label}: $filled of $KERNELS" },
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = c.likelihood(likelihood))
        Canvas(Modifier.size(width = 72.dp, height = 16.dp)) {
            val k = size.height / 14f
            for (i in 0 until KERNELS) {
                val on = i < filled
                val appear = ((progress.value * (KERNELS + 1)) - i).coerceIn(0f, 1f)
                translate(left = i * 15.dp.toPx()) {
                    scale(k, pivot = Offset.Zero) {
                        drawPath(kernelPath, if (on) fill.copy(alpha = fill.alpha * (0.35f + 0.65f * appear)) else c.kernelEmpty, style = Fill)
                        if (on && likelihood == Likelihood.HIGH) drawPath(kernelPath, c.kernelDeep, style = Stroke(width = .8f))
                    }
                }
            }
        }
    }
}

private fun Color.compositeOver(bg: Color) = Color(
    red = red * alpha + bg.red * (1 - alpha), green = green * alpha + bg.green * (1 - alpha),
    blue = blue * alpha + bg.blue * (1 - alpha), alpha = 1f,
)

// ---------- Cause entry: an entry on an agronomist's scouting sheet ----------

@Composable
fun CauseEntry(cause: PossibleCause, animate: Boolean = false) {
    val c = LocalMunda.current
    val border = if (cause.likelihood == Likelihood.HIGH) c.kernelDeep.copy(alpha = .55f) else c.ruleStrong
    Surface(shape = RoundedCornerShape(18.dp), color = c.paper, border = BorderStroke(1.dp, border), modifier = Modifier.fillMaxWidth()) {
        Column {
            Row(Modifier.padding(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 6.dp), verticalAlignment = Alignment.Top) {
                Text(cause.name, style = MaterialTheme.typography.titleLarge, color = c.ink, modifier = Modifier.weight(1f).padding(end = 12.dp))
                KernelMeter(cause.likelihood, animate)
            }
            Column(Modifier.padding(start = 18.dp, end = 18.dp, top = 6.dp, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (cause.supporting.isNotEmpty()) Evidence("Fits what you saw", cause.supporting, c.leaf, hollow = false)
                if (cause.againstOrMissing.isNotEmpty()) Evidence("Doesn't fit, or still unknown", cause.againstOrMissing, c.ink2, hollow = true)
            }
            Row(Modifier.fillMaxWidth().background(c.leafWash).padding(horizontal = 18.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Outlined.Checklist, null, tint = c.leaf, modifier = Modifier.size(18.dp).padding(top = 2.dp))
                Text(
                    buildBold("Check next. ", cause.checkNext),
                    style = MaterialTheme.typography.bodyMedium, color = c.ink,
                )
            }
        }
    }
}

@Composable
private fun Evidence(title: String, items: List<String>, color: Color, hollow: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.labelMedium, color = color)
        items.forEach { item ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    Modifier.padding(top = 7.dp).size(8.dp).clip(CircleShape)
                        .then(if (hollow) Modifier.border(2.dp, color, CircleShape) else Modifier.background(color)),
                )
                Text(item, style = MaterialTheme.typography.bodyMedium, color = LocalMunda.current.ink)
            }
        }
    }
}

private fun buildBold(bold: String, rest: String) = androidx.compose.ui.text.buildAnnotatedString {
    pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.Bold)); append(bold); pop(); append(rest)
}

@Composable
fun UncertaintyNote(text: String) {
    val c = LocalMunda.current
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.paper)
            .border(BorderStroke(1.dp, c.ruleStrong), RoundedCornerShape(12.dp)).padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.AutoMirrored.Outlined.HelpOutline, null, tint = c.ink2, modifier = Modifier.size(18.dp).padding(top = 2.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, color = c.ink2)
    }
}

// ---------- Inputs ----------

/** Single-choice group; real radio semantics for TalkBack, 44dp+ targets. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun <T> ChoiceGroup(legend: String, options: List<T>, selected: T?, label: (T) -> String, onSelect: (T) -> Unit) {
    val c = LocalMunda.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(legend, style = MaterialTheme.typography.titleSmall, color = c.ink)
        FlowRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEach { o ->
                val on = o == selected
                Box(
                    Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(8.dp))
                        .background(if (on) c.leaf else c.paper)
                        .border(1.5.dp, if (on) c.leaf else c.ruleStrong, RoundedCornerShape(8.dp))
                        .selectable(selected = on, role = Role.RadioButton, onClick = { onSelect(o) })
                        .padding(horizontal = 16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(label(o), style = if (on) MaterialTheme.typography.labelLarge else MaterialTheme.typography.bodyMedium, color = if (on) c.onLeaf else c.ink)
                }
            }
        }
    }
}

// ---------- Progress ----------

@Composable
fun Working(text: String) {
    val c = LocalMunda.current
    val t = rememberInfiniteTransition(label = "working")
    val a by t.animateFloat(1f, .35f, infiniteRepeatable(tween(550), RepeatMode.Reverse), label = "pulse")
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(vertical = 8.dp)) {
        Box(Modifier.size(width = 10.dp, height = 14.dp).clip(RoundedCornerShape(50)).background(c.kernel.copy(alpha = a)))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = c.ink2)
    }
}

/** The observation flow is a real sequence, so it shows progress through three steps. */
@Composable
fun Stepper(step: Int, modifier: Modifier = Modifier) {
    val c = LocalMunda.current
    val steps = listOf("Describe", "Questions", "Possible causes")
    Row(modifier.semantics { contentDescription = "Step ${step + 1} of 3: ${steps[step]}" }, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        steps.forEachIndexed { i, s ->
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(when { i == step -> c.leaf; i < step -> c.leafSoft; else -> c.rule }))
                if (i == step) Text(s, style = MaterialTheme.typography.labelMedium, color = c.ink) else Spacer(Modifier.height(0.dp))
            }
        }
    }
}

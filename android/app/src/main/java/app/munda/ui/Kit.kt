package app.munda.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.munda.data.inference.LocalModelInfo
import app.munda.domain.*
import kotlin.math.PI
import kotlin.math.sin

/** Design B building blocks shared by every screen; the Compose twin of web/src/ui/styles.css. */

@Composable
fun Tag(text: String, modifier: Modifier = Modifier) =
    Text(text.uppercase(), modifier, style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp), color = LocalMunda.current.ink2)

@Composable
fun CardBox(modifier: Modifier = Modifier, padding: PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 14.dp), content: @Composable ColumnScope.() -> Unit) =
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(LocalMunda.current.card).padding(padding), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)

enum class ButtonKind { PRIMARY, MAIZE, GHOST }

@Composable
fun MainButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, kind: ButtonKind = ButtonKind.PRIMARY, icon: ImageVector? = null) {
    val c = LocalMunda.current
    val (bg, fg) = when (kind) { ButtonKind.PRIMARY -> c.forest to Color.White; ButtonKind.MAIZE -> c.maize to c.forest; ButtonKind.GHOST -> c.card to c.leaf }
    Button(
        onClick, modifier.fillMaxWidth().heightIn(min = 54.dp), enabled = enabled, shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(containerColor = bg, contentColor = fg, disabledContainerColor = c.ruleStrong, disabledContentColor = Color.White),
        border = if (kind == ButtonKind.GHOST) BorderStroke(2.dp, c.rule) else null,
    ) {
        icon?.let { Icon(it, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)) }
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

/** Light header for every screen but Home: back, a short title, an action slot. */
@Composable
fun PageHead(title: String = "", onBack: (() -> Unit)? = null, right: @Composable () -> Unit = { Spacer(Modifier.size(44.dp)) }) {
    val c = LocalMunda.current
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (onBack != null) {
            IconButton(onBack, Modifier.size(44.dp).clip(CircleShape).background(c.card)) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, strings().t("common.back"), tint = c.ink) }
        } else Spacer(Modifier.size(44.dp))
        Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        right()
    }
}

/** The deep-green home header with the drawn maize field. */
@Composable
fun Hero(right: @Composable () -> Unit, meta: (@Composable RowScope.() -> Unit)?, content: @Composable ColumnScope.() -> Unit) {
    val c = LocalMunda.current
    Box(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(bottomStart = 30.dp, bottomEnd = 30.dp))
            .background(Brush.linearGradient(listOf(c.forest, c.leaf))).statusBarsPadding().padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 60.dp),
    ) {
        FieldScene(Modifier.align(Alignment.TopEnd).padding(top = 34.dp, end = 52.dp).size(width = 170.dp, height = 78.dp))
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("munda", style = MaterialTheme.typography.titleLarge, color = Color.White, modifier = Modifier.weight(1f))
                right()
            }
            meta?.let { Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically, content = it) }
            content()
        }
    }
}

/** A sun, a hill and a row of maize that sways slightly (web: Header.tsx FieldScene). */
@Composable
fun FieldScene(modifier: Modifier = Modifier) {
    val c = LocalMunda.current
    val sway by rememberInfiniteTransition(label = "sway").animateFloat(-2.2f, 2.2f, infiniteRepeatable(tween(4000), RepeatMode.Reverse), label = "angle")
    Canvas(modifier) {
        val sx = size.width / 220f
        val sy = size.height / 100f
        fun ground(x: Float) = 96f - 8f * sin((x / 220f) * PI.toFloat() + .5f)
        drawCircle(c.maize.copy(alpha = .6f), 13f * sx, Offset(176f * sx, 22f * sy))
        val hill = Path().apply { moveTo(0f, ground(0f) * sy); for (i in 0..11) lineTo(i * 20f * sx, ground(i * 20f) * sy); lineTo(size.width, size.height); lineTo(0f, size.height); close() }
        drawPath(hill, Color.White.copy(alpha = .08f))
        val green = Color(0xFF9FD8AE)
        listOf(22f, 48f, 76f, 102f, 130f, 156f, 184f).forEachIndexed { i, x ->
            val h = (44f + ((i * 7) % 4) * 5f)
            translate(x * sx, ground(x) * sy) {
                rotate(if (i % 2 == 0) sway else -sway, pivot = Offset.Zero) {
                    val k = sy
                    drawLine(green.copy(alpha = .45f), Offset.Zero, Offset(0f, -h * k), 2f * sx, StrokeCap.Round)
                    fun leaf(at: Float, dir: Float, len: Float) {
                        val p = Path().apply {
                            moveTo(0f, -h * at * k)
                            quadraticTo(dir * len * .5f * sx, -h * (at + .14f) * k, dir * len * sx, -h * at * k)
                            quadraticTo(dir * len * .4f * sx, -h * (at + .03f) * k, 0f, -h * (at - .06f) * k); close()
                        }
                        drawPath(p, green.copy(alpha = .4f))
                    }
                    leaf(.3f, 1f, 17f); leaf(.5f, -1f, 17f); leaf(.7f, 1f, 13f)
                    drawOval(c.maize.copy(alpha = .55f), Offset(-4.7f * sx, (-h * .6f - 5f) * k), Size(4.4f * sx, 10f * k))
                }
            }
        }
    }
}

/** Connection + offline AI state; opens to explain and to start the model download. */
@Composable
fun StatusPill(online: Boolean, local: LocalModelInfo, onDownload: () -> Unit, light: Boolean = false) {
    val c = LocalMunda.current
    val s = strings()
    var open by remember { mutableStateOf(false) }
    val (text, dot) = when (local.state) {
        LocalModelState.AVAILABLE -> s.t("status.aiReady") to Color(0xFF34C26E)
        LocalModelState.DOWNLOADING -> s.t("status.aiDownloading", "pct" to (local.downloadProgress?.let { "${(it * 100).toInt()}%" } ?: "")).trim() to Color(0xFFB8C1B4)
        LocalModelState.DOWNLOADABLE -> s.t("status.aiNotDownloaded") to c.maize
        LocalModelState.UNAVAILABLE -> s.t("status.aiCloudOnly") to Color(0xFF7FB6E6)
        else -> s.t("status.aiChecking") to Color(0xFFB8C1B4)
    }
    Box {
        Row(
            Modifier.clip(RoundedCornerShape(50)).background(if (light) c.card else Color.White.copy(alpha = .12f)).clickable { open = true }
                .padding(horizontal = 11.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            val fg = if (light) c.ink else Color.White
            Icon(if (online) Icons.Outlined.Wifi else Icons.Outlined.WifiOff, s.t(if (online) "status.online" else "status.offline"), Modifier.size(15.dp), tint = fg)
            Box(Modifier.size(8.dp).clip(CircleShape).background(dot))
            Text(text, style = MaterialTheme.typography.labelMedium, color = fg)
        }
        DropdownMenu(open, { open = false }, Modifier.widthIn(max = 320.dp)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { StatusDetails(online, local, onDownload) }
        }
    }
}

@Composable
fun StatusDetails(online: Boolean, local: LocalModelInfo, onDownload: () -> Unit) {
    val s = strings()
    Text(s.t(if (online) "status.onlineDetail" else "status.offlineDetail"), style = MaterialTheme.typography.bodyMedium)
    Text(
        s.t(when (local.state) { LocalModelState.AVAILABLE -> "status.aiReadyDetail"; LocalModelState.UNAVAILABLE -> "status.aiUnavailableDetail"; else -> "status.aiDownloadDetail" }),
        style = MaterialTheme.typography.bodyMedium,
    )
    if (local.state == LocalModelState.DOWNLOADING) local.downloadProgress?.let { LinearProgressIndicator({ it }, Modifier.fillMaxWidth()) }
    if (local.state == LocalModelState.DOWNLOADABLE) MainButton(s.t("status.downloadAi"), onDownload, enabled = online, kind = ButtonKind.GHOST, icon = Icons.Outlined.Download)
}

/** One line at the top for the moments that make hybrid AI visible (web: ConnectionBanner). */
@Composable
fun ConnectionBanner(online: Boolean, syncing: Boolean, reviewAdded: ReviewAdded?, onOpen: (String) -> Unit) {
    val c = LocalMunda.current
    val s = strings()
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(reviewAdded) { if (reviewAdded != null) { kotlinx.coroutines.delay(8_050); now = System.currentTimeMillis() } }
    val fresh = reviewAdded != null && now - reviewAdded.at < 8_000 || (reviewAdded != null && System.currentTimeMillis() - reviewAdded.at < 8_000)
    val (text, icon, colors) = when {
        !online -> Triple(s.t("banner.offline"), Icons.Outlined.WifiOff, c.forest to Color.White)
        syncing -> Triple(s.t("banner.syncing"), Icons.Outlined.CloudUpload, c.skyWash to c.sky)
        fresh -> Triple(s.t("banner.reviewed", "plot" to reviewAdded!!.plot), Icons.Outlined.History, c.husk to c.ink)
        else -> return
    }
    Row(
        Modifier.fillMaxWidth().background(colors.first).then(if (fresh && online && !syncing) Modifier.clickable { onOpen(reviewAdded!!.id) } else Modifier)
            .statusBarsPadding().padding(horizontal = 16.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(16.dp), tint = colors.second)
        Spacer(Modifier.width(8.dp))
        Text(text, style = MaterialTheme.typography.labelMedium, color = colors.second)
    }
}

/** Large picture answers in two columns; "Not sure" is a quiet text button (web: PictureChoice). */
@Composable
fun <T> PictureTiles(options: List<T>, unknown: T?, selected: T?, picture: @Composable (T) -> Unit, label: (T) -> String, onSelect: (T) -> Unit) {
    val c = LocalMunda.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        options.filter { it != unknown }.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { o ->
                    val on = o == selected
                    Column(
                        Modifier.weight(1f).clip(RoundedCornerShape(20.dp)).background(if (on) c.leafWash else c.card)
                            .border(2.dp, if (on) c.leaf else c.rule, RoundedCornerShape(20.dp))
                            .clickable(role = Role.RadioButton) { onSelect(o) }.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Box { picture(o); if (on) Icon(Icons.Outlined.CheckCircle, null, Modifier.align(Alignment.TopEnd).padding(4.dp), tint = c.leaf) }
                        Text(label(o), style = MaterialTheme.typography.titleSmall)
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
        if (unknown != null) TextButton({ onSelect(unknown) }, Modifier.align(Alignment.CenterHorizontally)) {
            Text(strings().t("common.notSure"), color = c.ink2, style = MaterialTheme.typography.labelLarge.copy(textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline))
        }
    }
}

/** Where Munda's AI worked on this record: green device, blue cloud, dashed waiting (web: HybridTrail). */
@Composable
fun HybridTrail(o: Observation, synced: Boolean) {
    val c = LocalMunda.current
    val s = strings()
    val steps = Trail.of(o, synced)
    CardBox {
        Tag(s.t("trail.title"))
        Row(Modifier.fillMaxWidth()) {
            steps.forEachIndexed { i, st ->
                val (bg, fg) = when {
                    st.state == TrailState.FAILED -> c.rustWash to c.rust
                    st.state == TrailState.DONE && st.where == TrailWhere.DEVICE -> c.leaf2 to Color.White
                    st.state == TrailState.DONE -> c.sky to Color.White
                    else -> c.mist to c.ink2
                }
                val key = when (st.id) {
                    TrailId.SAVED -> "trail.saved"
                    TrailId.CAUSES -> when (st.state) { TrailState.DONE -> if (st.where == TrailWhere.DEVICE) "trail.causesDevice" else "trail.causesCloud"; TrailState.FAILED -> "trail.causesFailed"; else -> "trail.causesWaiting" }
                    TrailId.SYNCED -> if (st.state == TrailState.DONE) "trail.synced" else "trail.syncWaiting"
                    TrailId.REVIEW -> when (st.state) { TrailState.DONE -> "trail.review"; TrailState.FAILED -> "trail.reviewFailed"; else -> "trail.reviewWaiting" }
                }
                val icon = if (st.state == TrailState.FAILED) Icons.Outlined.ErrorOutline else when (st.id) {
                    TrailId.SAVED -> Icons.Outlined.SdStorage; TrailId.CAUSES -> Icons.Outlined.AutoAwesome; TrailId.SYNCED -> Icons.Outlined.CloudUpload; TrailId.REVIEW -> Icons.Outlined.History
                }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.fillMaxWidth().height(40.dp), contentAlignment = Alignment.Center) {
                        if (i < steps.lastIndex) {
                            val lineColor = if (st.state == TrailState.DONE) c.leaf2 else c.ruleStrong
                            val dashed = st.state != TrailState.DONE
                            // From this circle's edge to the next one's (the next column is the same width).
                            Canvas(Modifier.matchParentSize()) {
                                val r = 22.dp.toPx()
                                drawLine(lineColor, Offset(size.width / 2 + r, size.height / 2), Offset(size.width * 1.5f - r, size.height / 2), 2.dp.toPx(),
                                    pathEffect = if (dashed) androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(8f, 6f)) else null)
                            }
                        }
                        Box(
                            Modifier.size(40.dp).clip(CircleShape).background(bg).then(if (st.state == TrailState.WAITING) Modifier.border(2.dp, c.ruleStrong, CircleShape) else Modifier),
                            contentAlignment = Alignment.Center,
                        ) { Icon(icon, null, Modifier.size(18.dp), tint = fg) }
                    }
                    Text(s.t(key), style = MaterialTheme.typography.labelSmall.copy(fontWeight = if (st.state == TrailState.WAITING) FontWeight.Normal else FontWeight.Bold), textAlign = androidx.compose.ui.text.style.TextAlign.Center, color = if (st.state == TrailState.WAITING) c.ink2 else c.ink)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        val col = if (st.where == TrailWhere.DEVICE) c.leaf2 else c.sky
                        Icon(if (st.where == TrailWhere.DEVICE) Icons.Outlined.PhoneAndroid else Icons.Outlined.Cloud, null, Modifier.size(11.dp), tint = col)
                        Text(s.t(if (st.where == TrailWhere.DEVICE) "trail.device" else "trail.cloud").uppercase(), style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, fontWeight = FontWeight.Bold), color = col)
                    }
                }
            }
        }
    }
}

/** Affected area per record over time; a blue dot marks records after heavy rain. */
@Composable
fun TimelineBars(points: List<TimelinePoint>, max: Int = 8) {
    val c = LocalMunda.current
    val s = strings()
    val shown = points.takeLast(max)
    if (shown.isEmpty()) return
    CardBox {
        Row(Modifier.fillMaxWidth().height(96.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
            shown.forEach { p ->
                val color = when (p.extent.coerceAtMost(3)) { 0, 1 -> c.sprout; 2 -> c.maize; else -> Color(0xFFF08A24) }
                Column(Modifier.weight(1f, fill = false).width(34.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    if (p.heavyRain) Box(Modifier.size(5.dp).clip(CircleShape).background(c.sky))
                    Spacer(Modifier.height(3.dp))
                    Box(Modifier.fillMaxWidth().fillMaxHeight(if (p.extent == 0) .12f else p.extent / 3f).clip(RoundedCornerShape(6.dp)).background(color))
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(s.shortDate(shown.first().at), style = MaterialTheme.typography.labelSmall, color = c.ink2)
            if (shown.size > 1) Text(s.shortDate(shown.last().at), style = MaterialTheme.typography.labelSmall, color = c.ink2)
        }
    }
}

/** Tiny trend line; rust when the last record is worse than the first. */
@Composable
fun Trend(points: List<TimelinePoint>) {
    val p = points.takeLast(6)
    if (p.size < 2) return
    val c = LocalMunda.current
    val worse = p.last().extent > p.first().extent
    Canvas(Modifier.size(60.dp, 22.dp)) {
        val path = Path()
        p.forEachIndexed { i, x ->
            val px = (i / (p.size - 1f)) * (size.width - 4) + 2
            val py = size.height - 2 - x.extent * (size.height - 4) / 3f
            if (i == 0) path.moveTo(px, py) else path.lineTo(px, py)
        }
        drawPath(path, if (worse) c.rust else c.leaf2, style = Stroke(2.4.dp.toPx(), cap = StrokeCap.Round))
    }
}

/** "Check before buying anything": the one thing to do before spending money. */
@Composable
fun CheckFirst(text: String) {
    val c = LocalMunda.current
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.forest).padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(Icons.Outlined.Visibility, null, Modifier.size(16.dp), tint = c.maize)
            Text(strings().t("result.checkFirst").uppercase(), style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp), color = c.maize)
        }
        Text(text, style = MaterialTheme.typography.bodyMedium, color = Color.White)
    }
}

@Composable
fun Evidence(supporting: List<String>, against: List<String>) {
    val c = LocalMunda.current
    val s = strings()
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        supporting.forEach { e -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Icon(Icons.Outlined.Check, s.t("result.fits"), Modifier.size(17.dp), tint = c.leaf2); Text(e, style = MaterialTheme.typography.bodyMedium) } }
        against.forEach { e -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Icon(Icons.Outlined.Close, s.t("result.gaps"), Modifier.size(17.dp), tint = c.rust); Text(e, style = MaterialTheme.typography.bodyMedium, color = c.ink2) } }
    }
}

/** A possible cause: the lead one as a full card, the others as rows that open (web: CauseCard). */
@Composable
fun CauseCard(cause: PossibleCause, display: CauseDisplay, lead: Boolean, animate: Boolean = false) {
    val c = LocalMunda.current
    val s = strings()
    var open by remember { mutableStateOf(lead) }
    CardBox(Modifier.then(if (lead) Modifier else Modifier.clickable { open = !open })) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(display.name, style = if (lead) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleSmall)
                if (!lead) Text(s.likelihood(cause.likelihood), style = MaterialTheme.typography.labelSmall, color = c.ink2)
            }
            KernelMeter(cause.likelihood, animate = animate)
            if (!lead) Icon(Icons.Outlined.ExpandMore, null, Modifier.rotate(if (open) 180f else 0f), tint = c.ink2)
        }
        if (open) {
            if (cause.guideId == null) Text(s.t("result.outsideGuide"), Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(c.skyWash).padding(horizontal = 12.dp, vertical = 8.dp),
                style = MaterialTheme.typography.labelMedium, color = c.sky)
            if (lead && Guides.forCrop(Crop.MAIZE).get(cause.guideId)?.report == true) ReportNow()
            if (lead) GuidePicture(cause.guideId, display.name, compact = true)
            Evidence(cause.supporting, cause.againstOrMissing)
            CheckFirst(display.check)
            display.modelCheck?.let { Text("${s.t("result.modelNote")}: $it", style = MaterialTheme.typography.bodySmall, color = c.ink2) }
        }
    }
}

@Composable
fun CauseList(causes: List<PossibleCause>, display: (PossibleCause) -> CauseDisplay, animate: Boolean = false) {
    if (causes.isEmpty()) return
    CauseCard(causes.first(), display(causes.first()), lead = true, animate = animate)
    if (causes.size > 1) Tag(strings().t("result.otherCauses"), Modifier.padding(top = 4.dp))
    causes.drop(1).forEach { CauseCard(it, display(it), lead = false) }
}

/** Small uppercase label above a heading (web: .eyebrow). */
@Composable
fun Eyebrow(text: String, color: Color) =
    Text(text.uppercase(), style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.4.sp, fontWeight = FontWeight.Bold), color = color)

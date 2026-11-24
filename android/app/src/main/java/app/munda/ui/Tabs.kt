package app.munda.ui

import androidx.compose.foundation.Image
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import app.munda.R
import android.app.DatePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.munda.data.cropWeeks
import app.munda.domain.*
import java.util.Calendar

@Composable
private fun Page(content: @Composable ColumnScope.() -> Unit) =
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp), content = content)

// ---------------- Home ----------------

@Composable
fun HomeScreen(vm: FarmViewModel, onCheck: () -> Unit, onOpen: (String) -> Unit, onPlot: (String) -> Unit, onPlots: () -> Unit, onGuide: () -> Unit = {}) {
    val c = LocalMunda.current
    val s = strings()
    val items = vm.items.collectAsStateWithLifecycle().value.orEmpty()
    val p by vm.prefs.collectAsStateWithLifecycle()
    val online by vm.online.collectAsStateWithLifecycle()
    val local by vm.localModel.collectAsStateWithLifecycle()
    val w = WeatherRules.fresh(vm.weather.collectAsStateWithLifecycle().value, System.currentTimeMillis())
    val observations = items.map { it.observation }
    val plots = Farm.plots(observations)
    val summary = Farm.summary(plots)
    val alert = Farm.latestAlert(observations)
    val unsynced = items.any { !it.synced }
    val active = plots.firstOrNull()
    val weeks = active?.let { cropWeeks(p.plantedAt[it.key], System.currentTimeMillis()) }
    val stage = active?.latest?.cropStage?.takeIf { it != CropStage.UNKNOWN }?.let { s.stage(it) }
    val cropLine = listOfNotNull(s.t("home.cropLine"), weeks?.let { s.t("home.weeks", "weeks" to it) }, stage).joinToString(" · ")

    Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        Hero(
            right = { StatusPill(online, local, vm::downloadModel) },
            meta = if (p.place.isNotBlank() || w != null) ({
                val white = Color.White.copy(alpha = .9f)
                if (p.place.isNotBlank()) Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Place, null, Modifier.size(14.dp), tint = white); Spacer(Modifier.width(4.dp))
                    Text(p.place, style = MaterialTheme.typography.labelMedium, color = white)
                }
                if (w != null) Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (w.rainSoon) Icons.Outlined.Umbrella else Icons.Outlined.WbSunny, null, Modifier.size(14.dp), tint = white); Spacer(Modifier.width(4.dp))
                    val rain = if (w.rainSoon && w.rainDay != null) s.t("home.rainOn", "day" to s.weekday(w.rainDay)) else s.t("home.noRain")
                    Text("${s.t("home.temp", "temp" to w.tempC)} · $rain", style = MaterialTheme.typography.labelMedium, color = white)
                }
            }) else null,
        ) {
            Eyebrow(s.t("studio.overview"), Color.White.copy(alpha = .8f))
            Text(if (p.name.isNotBlank()) s.t("home.greeting", "name" to p.name) else s.t("home.greetingNoName"), style = MaterialTheme.typography.headlineMedium, color = Color.White)
            Text(cropLine, style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = .85f))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                @Composable fun RowScope.Stat(value: @Composable () -> Unit, label: String) = Column(
                    Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(Color.White.copy(alpha = .13f)).padding(horizontal = 12.dp, vertical = 10.dp),
                ) { value(); Text(label, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = .85f)) }
                Stat({ Text("${summary.plots}", style = MaterialTheme.typography.titleLarge, color = Color.White) }, s.t("home.statPlots"))
                Stat({ Text("${summary.needsCheck}", style = MaterialTheme.typography.titleLarge, color = if (summary.needsCheck > 0) c.maize else Color.White) }, s.t("home.statNeedsCheck"))
                Stat({ Icon(if (unsynced || !online) Icons.Outlined.SdStorage else Icons.Outlined.Check, null, Modifier.size(26.dp), tint = Color.White) },
                    s.t(if (unsynced || !online) "home.statSaved" else "home.statSynced"))
            }
        }
        // The check card overlaps the hero, with the field painting (web: HomePage + FieldArtwork).
        Column(
            Modifier.padding(horizontal = 16.dp).offset(y = (-36).dp).fillMaxWidth().shadow(10.dp, RoundedCornerShape(20.dp)).clip(RoundedCornerShape(20.dp))
                .background(c.card).clickable(onClick = onCheck),
        ) {
            Image(painterResource(R.drawable.field_study), null, Modifier.fillMaxWidth().height(120.dp), contentScale = ContentScale.Crop)
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Eyebrow(s.t("studio.fieldCheck"), c.leaf)
                Text(s.t("home.checkCrop"), style = MaterialTheme.typography.titleLarge)
                Text(s.t("home.checkCropSub"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
                Row(
                    Modifier.padding(top = 6.dp).clip(RoundedCornerShape(14.dp)).background(c.maize).padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(Icons.Outlined.PhotoCamera, null, tint = c.forest, modifier = Modifier.size(20.dp))
                    Text(s.t("home.checkCrop"), style = MaterialTheme.typography.labelLarge, color = c.forest)
                }
            }
        }
        Page {
            Spacer(Modifier.height(0.dp).offset(y = (-36).dp))
            vm.alerts.collectAsStateWithLifecycle().value.firstOrNull()?.let { GroupAlertCard(it, vm) }
            if (alert != null) {
                Row(
                    Modifier.offset(y = (-22).dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(c.husk).clickable { onOpen(alert.observation.id) }.padding(14.dp),
                    horizontalArrangement = Arrangement.spacedBy(11.dp),
                ) {
                    Icon(Icons.Outlined.WarningAmber, null, tint = c.maizeDeep)
                    Column {
                        Text("${s.t("home.alert")} · ${alert.observation.plot}", style = MaterialTheme.typography.titleSmall)
                        Text("${s.pattern(alert.pattern.kind)}. ${alert.observation.review?.nextChecks?.firstOrNull() ?: alert.pattern.summary}", style = MaterialTheme.typography.bodySmall, color = c.ink2)
                    }
                }
            }
            if (active != null) {
                Column(Modifier.offset(y = (-22).dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Tag("${s.t("home.timeline")} · ${active.name}", Modifier.weight(1f))
                        Text(s.t("common.seeAll"), Modifier.clickable(onClick = onPlots), style = MaterialTheme.typography.labelMedium, color = c.leaf)
                    }
                    Box(Modifier.clickable { onPlot(active.key) }) { TimelineBars(Farm.timeline(observations, active.key)) }
                }
            } else {
                // Empty farm: the start of the field story (web: studio.emptyTitle).
                Column(
                    Modifier.offset(y = (-22).dp).fillMaxWidth().border(1.dp, c.rule, RoundedCornerShape(18.dp)).padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(c.leafWash), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.Eco, null, tint = c.leaf) }
                    Text(s.t("studio.emptyTitle"), style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
                    Text(s.t("studio.emptyHelp"), style = MaterialTheme.typography.bodySmall, color = c.ink2, textAlign = TextAlign.Center)
                    MainButton(s.t("studio.firstCheck"), onCheck, kind = ButtonKind.GHOST)
                }
            }
            // The guide, one tap from home (web: studio.library card).
            Row(
                Modifier.offset(y = (-22).dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(c.card).clickable(onClick = onGuide).padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(c.leafWash), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.MenuBook, null, tint = c.leaf) }
                Column(Modifier.weight(1f)) {
                    Text(s.t("studio.library"), style = MaterialTheme.typography.titleSmall)
                    Text(s.t("studio.libraryHelp"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
                    Text(s.t("studio.learn"), style = MaterialTheme.typography.labelMedium, color = c.leaf)
                }
            }
        }
    }
}

// ---------------- Plots ----------------

@Composable
fun PlotsScreen(vm: FarmViewModel, onPlot: (String) -> Unit) {
    val c = LocalMunda.current
    val s = strings()
    val items = vm.items.collectAsStateWithLifecycle().value
    val observations = items.orEmpty().map { it.observation }
    val plots = Farm.plots(observations)
    Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        PageHead(s.t("plots.title"))
        Page {
            when {
                items == null -> Working(s.t("common.loading"))
                plots.isEmpty() -> Text(s.t("plots.empty"), Modifier.fillMaxWidth().border(1.dp, c.rule, RoundedCornerShape(16.dp)).padding(16.dp), color = c.ink2)
                else -> {
                    FieldMap(plots, onPlot)
                    plots.forEach { p ->
                        Row(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(c.card).clickable { onPlot(p.key) }.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            val (dot, ring) = statusColors(p.status)
                            Box(Modifier.size(18.dp).clip(CircleShape).background(ring), contentAlignment = Alignment.Center) { Box(Modifier.size(10.dp).clip(CircleShape).background(dot)) }
                            Column(Modifier.weight(1f)) {
                                Text(p.name, style = MaterialTheme.typography.titleSmall)
                                val count = if (p.count == 1) s.t("plots.recordsOne") else s.t("plots.records", "n" to p.count)
                                Text("${s.plotStatus(p.status)} · ${s.t("plots.lastChecked", "when" to s.ago(p.lastAt))} · $count", style = MaterialTheme.typography.labelSmall, color = c.ink2)
                            }
                            Trend(Farm.timeline(observations, p.key))
                            Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, tint = c.ink2)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun statusColors(st: PlotStatus): Pair<Color, Color> {
    val c = LocalMunda.current
    return when (st) { PlotStatus.OK -> c.leaf2 to c.sprout; PlotStatus.WATCH -> c.maize to c.husk; PlotStatus.ACT -> c.rust to c.rustWash }
}

/** Each plot a striped field coloured by how it's doing; the last field fills its row (web: FieldMap). */
@Composable
private fun FieldMap(plots: List<PlotSummary>, onPlot: (String) -> Unit) {
    val c = LocalMunda.current
    val s = strings()
    var col = 0
    val spans = plots.mapIndexed { i, _ ->
        var span = if (i % 5 == 0) 2 else 1
        if (col + span > 3) col = 0
        if (i == plots.lastIndex) span = 3 - col
        col = (col + span) % 3
        span
    }
    val rows = mutableListOf<MutableList<Int>>()
    var used = 3
    spans.forEachIndexed { i, sp -> if (used + sp > 3) { rows.add(mutableListOf()); used = 0 }; rows.last().add(i); used += sp }
    Tag(s.t("plots.map"))
    rows.forEach { row ->
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEach { i ->
                val p = plots[i]
                val (tone, wash) = when (p.status) { PlotStatus.OK -> c.leaf2 to c.sprout; PlotStatus.WATCH -> c.maizeDeep to c.husk; PlotStatus.ACT -> c.rust to c.rustWash }
                val angle = listOf(-24f, 18f, -8f, 30f, 4f)[i % 5]
                Column(
                    Modifier.weight(spans[i].toFloat()).height(92.dp).clip(RoundedCornerShape(18.dp)).background(wash)
                        .drawStripes(tone.copy(alpha = .22f), angle).border(2.dp, tone.copy(alpha = .45f), RoundedCornerShape(18.dp))
                        .clickable { onPlot(p.key) }.padding(10.dp),
                    verticalArrangement = Arrangement.Bottom,
                ) {
                    Text(p.name, Modifier.clip(RoundedCornerShape(6.dp)).background(c.card.copy(alpha = .85f)).padding(horizontal = 6.dp, vertical = 2.dp), style = MaterialTheme.typography.titleSmall)
                    Text(s.plotStatus(p.status), Modifier.padding(start = 6.dp, top = 3.dp), style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold), color = tone)
                }
            }
        }
    }
}

private fun Modifier.drawStripes(color: Color, angle: Float) = this.then(
    Modifier.drawBehind {
        rotate(angle) {
            val step = 11.dp.toPx()
            var x = -size.maxDimension
            while (x < size.maxDimension * 2) { drawLine(color, androidx.compose.ui.geometry.Offset(x, -size.maxDimension), androidx.compose.ui.geometry.Offset(x, size.maxDimension * 2), 2.dp.toPx()); x += step }
        }
    },
)

@Composable
fun PlotScreen(vm: FarmViewModel, plotKey: String, onBack: () -> Unit, onOpen: (String) -> Unit) {
    val c = LocalMunda.current
    val s = strings()
    val context = LocalContext.current
    val items = vm.items.collectAsStateWithLifecycle().value.orEmpty()
    val p by vm.prefs.collectAsStateWithLifecycle()
    val records = items.filter { it.observation.plotKey == plotKey }.sortedByDescending { it.observation.createdAtMillis }
    val name = records.firstOrNull()?.observation?.plot ?: plotKey
    val planted = p.plantedAt[plotKey]
    Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        PageHead(name, onBack)
        Page {
            Tag(s.t("plots.trend"))
            TimelineBars(Farm.timeline(items.map { it.observation }, plotKey), max = 12)
            CardBox {
                Text(s.t("plots.planted"), style = MaterialTheme.typography.titleSmall)
                Text(s.t("plots.plantedHelp"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
                MainButton(planted?.let { s.date(it) } ?: s.t("plots.planted"), {
                    val cal = Calendar.getInstance().apply { planted?.let { timeInMillis = it } }
                    DatePickerDialog(context, { _, y, m, d -> vm.setPlanted(plotKey, Calendar.getInstance().apply { set(y, m, d, 12, 0) }.timeInMillis) },
                        cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
                }, kind = ButtonKind.GHOST, icon = Icons.Outlined.CalendarMonth)
            }
            Tag(s.t("plots.history"))
            records.forEach { item ->
                val o = item.observation
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(c.card).clickable { onOpen(o.id) }.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(o.record?.possibleCauses?.firstOrNull()?.let { vm.c.guideText.causeDisplay(it, s.lang, Guides.forCrop(o.crop)).name } ?: o.description.take(60), style = MaterialTheme.typography.titleSmall)
                        Text("${s.date(o.createdAtMillis)} · ${s.area(o.core.area)}", style = MaterialTheme.typography.labelSmall, color = c.ink2)
                    }
                    Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, tint = c.ink2)
                }
            }
        }
    }
}

// ---------------- Guide ----------------

@Composable
fun GuideScreen(vm: FarmViewModel, onEntry: (String) -> Unit) {
    val c = LocalMunda.current
    val s = strings()
    val guide = Guides.forCrop(Crop.MAIZE)
    Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        PageHead(s.t("guide.title"))
        Page {
            Text(s.t("guide.subtitle"), style = MaterialTheme.typography.bodyMedium, color = c.ink2)
            guide.entries.groupBy { it.category }.forEach { (cat, entries) ->
                Tag(s.t("guide.categories.${cat.name}"))
                entries.forEach { e ->
                    val loc = vm.c.guideText.localized(e, s.lang)
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(c.card).clickable { onEntry(e.id) }.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        GuideThumb(e.id)
                        Column(Modifier.weight(1f)) {
                            Text(loc.name, style = MaterialTheme.typography.titleSmall)
                            Text(loc.signs, style = MaterialTheme.typography.labelSmall, color = c.ink2, maxLines = 2)
                        }
                        Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, tint = c.ink2)
                    }
                }
            }
        }
    }
}

@Composable
fun GuideEntryScreen(vm: FarmViewModel, id: String, onBack: () -> Unit) {
    val s = strings()
    val c = LocalMunda.current
    val context = LocalContext.current
    val e = Guides.forCrop(Crop.MAIZE).get(id) ?: return
    val loc = vm.c.guideText.localized(e, s.lang)
    Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        PageHead(s.t("guide.title"), onBack, right = { ReadAloud(listOfNotNull(loc.name, loc.signs, s.t("guide.check"), loc.checkInField, e.actNow?.takeIf { s.lang == "en" }?.let { "${s.t("guide.actNow")}. $it" }).joinToString(". ")) })
        Page {
            Tag(s.t("guide.categories.${e.category.name}"))
            Text(loc.name, style = MaterialTheme.typography.headlineMedium)
            GuidePicture(e.id, loc.name)
            CardBox {
                Text(s.t("guide.signs"), style = MaterialTheme.typography.titleSmall)
                Text(loc.signs, style = MaterialTheme.typography.bodyLarge)
            }
            if (e.report) ReportNow()
            CheckFirst(loc.checkInField)
            listOf("guide.byStage" to e.byStage, "guide.likelyWhen" to e.likelyWhen, "guide.actNow" to e.actNow, "guide.prevent" to e.prevent).forEach { (k, v) ->
                if (v != null) CardBox { Text(s.t(k), style = MaterialTheme.typography.titleSmall); Text(v, style = MaterialTheme.typography.bodyMedium) }
            }
            if (e.sources.isNotEmpty()) {
                Tag(s.t("guide.sources"))
                e.sources.forEach { src ->
                    Text("• ${src.title}", Modifier.clickable { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(src.url))) },
                        style = MaterialTheme.typography.bodySmall, color = c.leaf)
                }
                Text(s.t("guide.unchecked"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
            }
        }
    }
}

/** For problems that must be reported (e.g. MLN): a plain, red instruction. */
@Composable
fun ReportNow() {
    val c = LocalMunda.current
    Text(strings().t("guide.report"), Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.rustWash).padding(12.dp),
        style = MaterialTheme.typography.titleSmall, color = c.rust)
}

// ---------------- Me ----------------

@Composable
private fun SavedField(label: String, value: String, placeholder: String, onSave: (String) -> Unit) {
    var text by remember(value) { mutableStateOf(value) }
    OutlinedTextField(
        text, { text = it }, Modifier.fillMaxWidth().onFocusLost { if (text != value) onSave(text) },
        label = { Text(label) }, placeholder = { Text(placeholder) }, singleLine = true, shape = RoundedCornerShape(14.dp),
        keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = { onSave(text) }),
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Done),
    )
}

private fun Modifier.onFocusLost(block: () -> Unit) = this.then(
    Modifier.onFocusChanged { if (!it.isFocused) block() },
)

@Composable
fun MeScreen(vm: FarmViewModel) {
    val c = LocalMunda.current
    val s = strings()
    val p by vm.prefs.collectAsStateWithLifecycle()
    val online by vm.online.collectAsStateWithLifecycle()
    val local by vm.localModel.collectAsStateWithLifecycle()
    val w = WeatherRules.fresh(vm.weather.collectAsStateWithLifecycle().value, System.currentTimeMillis())
    val notFound by vm.placeNotFound.collectAsStateWithLifecycle()
    Column(Modifier.verticalScroll(rememberScrollState()).imePadding().padding(bottom = 24.dp)) {
        PageHead(s.t("me.title"))
        Page {
            CardBox {
                Text(s.t("me.language"), style = MaterialTheme.typography.titleSmall)
                @OptIn(ExperimentalLayoutApi::class)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    s.i18n.langs.forEach { l ->
                        val on = l.code == s.lang
                        Text(
                            if (l.beta) "${l.native} · ${s.t("common.beta")}" else l.native,
                            Modifier.clip(RoundedCornerShape(50)).background(if (on) c.forest else c.card).border(1.dp, if (on) c.forest else c.rule, RoundedCornerShape(50))
                                .clickable { vm.setLanguage(l.code) }.padding(horizontal = 12.dp, vertical = 7.dp),
                            style = MaterialTheme.typography.labelMedium, color = if (on) Color.White else c.ink,
                        )
                    }
                }
                if (s.i18n.info(s.lang).beta) Text(s.t("me.betaNote"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
            }
            CardBox {
                SavedField(s.t("me.name"), p.name, s.t("me.namePlaceholder"), vm::setName)
                SavedField(s.t("me.place"), p.place, s.t("me.placePlaceholder"), vm::setPlace)
            }
            CardBox {
                Text(s.t("me.weather"), style = MaterialTheme.typography.titleSmall)
                Text(s.t("me.weatherHelp"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
                MainButton(s.t(if (p.weatherOn) "me.weatherOff" else "me.weatherOn"), { vm.setWeather(!p.weatherOn) }, kind = if (p.weatherOn) ButtonKind.GHOST else ButtonKind.PRIMARY, icon = Icons.Outlined.Place)
                if (p.weatherOn && w != null) Text((w.where?.let { s.t("me.weatherFor", "place" to it) + " · " } ?: "") + s.t("home.temp", "temp" to w.tempC), style = MaterialTheme.typography.bodySmall)
                if (p.weatherOn && notFound != null) Text(s.t("me.placeNotFound", "place" to notFound!!), style = MaterialTheme.typography.bodySmall, color = c.alert)
                if (p.weatherOn && w == null && notFound == null && online) Text(s.t("me.weatherNone"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
            }
            CardBox {
                Text(s.t("me.extension"), style = MaterialTheme.typography.titleSmall)
                Text(s.t("me.extensionHelp"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
                SavedField(s.t("me.extName"), p.extension?.name.orEmpty(), "", { vm.setExtension(it, p.extension?.phone.orEmpty()) })
                SavedField(s.t("me.extPhone"), p.extension?.phone.orEmpty(), "", { vm.setExtension(p.extension?.name.orEmpty(), it) })
            }
            GroupCard(vm)
            CardBox {
                Text(s.t("me.offlineAi"), style = MaterialTheme.typography.titleSmall)
                StatusDetails(online, local, vm::downloadModel)
            }
            Text(s.t("me.about"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
        }
    }
}

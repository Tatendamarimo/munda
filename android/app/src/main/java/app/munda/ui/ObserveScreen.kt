package app.munda.ui

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import android.graphics.Bitmap
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.munda.AppContainer
import app.munda.data.inference.AiOutcome
import app.munda.data.inference.ObservationInput
import app.munda.domain.*
import app.munda.speech.SpeechCapture
import app.munda.speech.SpeechState
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/** The steps of a check, as on the web (web/src/ui/observe/steps.ts). */
enum class Step { DESCRIBE, PLOT, AREA, RAIN, ONSET, FOLLOWUPS, RESULT }

data class ObserveForm(
    val crop: Crop = Crop.MAIZE,
    val plot: String = "",
    val stage: CropStage = CropStage.UNKNOWN,
    val description: String = "",
    val photo: Bitmap? = null,
    val core: CoreAnswers = CoreAnswers(),
    /** Answers to AI questions, by question index. */
    val answers: Map<Int, String> = emptyMap(),
)

sealed interface QuestionsState {
    data object Idle : QuestionsState
    data object Loading : QuestionsState
    data class Ready(val questions: List<FollowUpQuestion>, val origin: InferenceOrigin) : QuestionsState
    /** [reason] empty means the model had nothing to ask: skip the step. */
    data class Unavailable(val reason: String) : QuestionsState
}

sealed interface RecordState {
    data object Idle : RecordState
    /** [text] is the answer so far, streamed. */
    data class Building(val text: String, val startedAt: Long, val route: Route, val candidates: List<GuideEntry>) : RecordState
    data class Done(val record: FieldRecord, val origin: InferenceOrigin, val latencyMs: Long) : RecordState
    data class Problem(val message: String) : RecordState
}

/** What Munda saw in the farmer's photo (photo-first checks). */
sealed interface Seen {
    data object Idle : Seen
    data object Reading : Seen
    data object Filled : Seen
    data object Unclear : Seen
    data class Suggest(val signs: String) : Seen
}

/** Long enough to see the tile light up before the next question slides in. */
private const val AUTO_ADVANCE_MS = 260L

class ObserveViewModel(private val c: AppContainer, app: Application) : ViewModel() {
    private val _form = MutableStateFlow(ObserveForm(plot = lastPlot(app)))
    val form: StateFlow<ObserveForm> = _form.asStateFlow()
    private val _step = MutableStateFlow(Step.DESCRIBE)
    val step: StateFlow<Step> = _step.asStateFlow()
    private val _questions = MutableStateFlow<QuestionsState>(QuestionsState.Idle)
    val questions: StateFlow<QuestionsState> = _questions.asStateFlow()
    private val _record = MutableStateFlow<RecordState>(RecordState.Idle)
    val record: StateFlow<RecordState> = _record.asStateFlow()
    private val prefs = app.getSharedPreferences("observe", Application.MODE_PRIVATE)
    private var questionsJob: Job? = null
    private var recordJob: Job? = null
    private var advanceJob: Job? = null
    private var questionsKey: String? = null
    private val _seen = MutableStateFlow<Seen>(Seen.Idle)
    val seen: StateFlow<Seen> = _seen.asStateFlow()
    private var seenJob: Job? = null
    /** The farmer's language, English name, for cloud calls. Set by the screen. */
    var language: String? = null

    val speech = SpeechCapture(app) { seg ->
        _form.update { f -> f.copy(description = (f.description.trimEnd() + " " + seg).trim().take(Normalize.MAX_DESCRIPTION)) }
    }
    val speechState: StateFlow<SpeechState> = speech.state

    private val description get() = _form.value.description.trim().ifEmpty { if (_form.value.photo != null) PHOTO_ONLY else "" }

    /** Where the AI will run, shown before the farmer taps. */
    val route: StateFlow<RouteDecision> = combine(_form, c.ai.localModel, c.connectivity.online) { f, local, online ->
        RoutingPolicy.decide(inputChars(f), local.state, online, c.settings.maxOnDeviceChars)
    }.stateIn(viewModelScope, SharingStarted.Eagerly, RoutingPolicy.decide(0, c.ai.localModel.value.state, c.connectivity.online.value, c.settings.maxOnDeviceChars))

    /** While questions load we still plan to show them; none, or unavailable, skips the step. */
    val hasFollowUps: Boolean get() = _step.value == Step.FOLLOWUPS || _questions.value is QuestionsState.Loading ||
        (_questions.value as? QuestionsState.Ready)?.questions?.isNotEmpty() == true
    fun steps(): List<Step> = Step.entries.filter { it != Step.FOLLOWUPS || hasFollowUps }

    fun edit(transform: (ObserveForm) -> ObserveForm) {
        val before = _form.value.photo
        _form.update { transform(it).let { f -> f.copy(description = f.description.take(Normalize.MAX_DESCRIPTION)) } }
        if (_record.value !is RecordState.Building) _record.value = RecordState.Idle
        if (_form.value.photo !== before) describePhoto()
    }

    /**
     * Photo only: Munda describes the visible signs so matching and questions work as if the farmer
     * had described it. Filled in when the description is empty (marked as Munda's words), offered otherwise.
     */
    private fun describePhoto() {
        seenJob?.cancel()
        val photo = _form.value.photo ?: run { _seen.value = Seen.Idle; return }
        val r = route.value.route
        if (r == Route.QUEUE_UNTIL_ONLINE) { _seen.value = Seen.Idle; return }
        _seen.value = Seen.Reading
        seenJob = viewModelScope.launch {
            _seen.value = when (val out = c.ai.describePhoto(photo, _form.value.crop, r, language)) {
                is AiOutcome.Done -> when {
                    !out.value.clear -> Seen.Unclear
                    _form.value.description.isBlank() -> { _form.update { it.copy(description = out.value.signs) }; Seen.Filled }
                    else -> Seen.Suggest(out.value.signs)
                }
                else -> Seen.Idle
            }
        }
    }

    fun acceptSeen(signs: String) {
        _form.update { it.copy(description = (it.description.trimEnd() + " " + signs).trim().take(Normalize.MAX_DESCRIPTION)) }
        _seen.value = Seen.Filled
    }

    val canDescribe get() = description.isNotEmpty()

    fun next() = goTo(steps().getOrNull(steps().indexOf(_step.value) + 1))

    fun back(): Boolean {
        val i = steps().indexOf(_step.value)
        if (_step.value == Step.RESULT) { recordJob?.cancel(); _record.value = RecordState.Idle }
        if (i <= 0) return false
        goTo(steps()[i - 1]); return true
    }

    private fun goTo(s: Step?) {
        s ?: return
        advanceJob?.cancel()
        if (s == Step.PLOT || s == Step.AREA) speech.stop()
        if (s == Step.AREA && _step.value == Step.PLOT) fetchQuestions()
        if (s == Step.RESULT) buildRecord()
        _step.value = s
    }

    /** A picture answer: apply it, then move on after a short pause so the tile visibly lights up. */
    fun answer(transform: (CoreAnswers) -> CoreAnswers) {
        edit { it.copy(core = transform(it.core)) }
        advanceJob?.cancel()
        advanceJob = viewModelScope.launch { delay(AUTO_ADVANCE_MS); next() }
    }

    /** Questions depend on description, stage and photo; fetched early so they're ready by the end. */
    private fun fetchQuestions() {
        val f = _form.value
        val key = "$description|${f.stage}|${f.photo?.hashCode()}"
        if (questionsKey == key && (_questions.value is QuestionsState.Ready || _questions.value is QuestionsState.Loading)) return
        questionsKey = key
        _form.update { it.copy(answers = emptyMap()) }
        val decision = route.value
        if (decision.route == Route.QUEUE_UNTIL_ONLINE) { _questions.value = QuestionsState.Unavailable("unavailable"); return }
        _questions.value = QuestionsState.Loading
        questionsJob?.cancel()
        questionsJob = viewModelScope.launch {
            _questions.value = when (val out = c.ai.followUpQuestions(input(false), decision.route, language)) {
                is AiOutcome.Done -> if (out.value.isEmpty()) QuestionsState.Unavailable("") else QuestionsState.Ready(out.value, out.origin)
                else -> QuestionsState.Unavailable("failed")
            }
            // The model had nothing to ask while the farmer waited on that screen: move on.
            if (_step.value == Step.FOLLOWUPS && (_questions.value as? QuestionsState.Unavailable)?.reason == "") goTo(Step.RESULT)
        }
    }

    private fun buildRecord() {
        val decision = route.value
        if (decision.route == Route.QUEUE_UNTIL_ONLINE) { _record.value = RecordState.Problem(decision.reason); return }
        val inp = input(true)
        _record.value = RecordState.Building("", System.currentTimeMillis(), decision.route, c.ai.recordCandidates(inp))
        recordJob?.cancel()
        recordJob = viewModelScope.launch {
            val out = c.ai.buildRecord(inp, decision.route, language) { text -> _record.update { r -> if (r is RecordState.Building) r.copy(text = text) else r } }
            _record.value = when (out) {
                is AiOutcome.Done -> RecordState.Done(out.value, out.origin, out.latencyMs)
                is AiOutcome.Deferred -> RecordState.Problem(out.reason)
                is AiOutcome.Failed -> RecordState.Problem(out.reason)
            }
        }
    }

    /** Durable locally the moment this returns (Firestore offline cache); follow-up work is queued. */
    fun save(onSaved: (String) -> Unit) {
        val s = c.session.ready ?: return
        val f = _form.value
        val done = _record.value as? RecordState.Done
        val o = Observation(
            id = c.repository.newId(s.orgId), orgId = s.orgId, ownerUid = s.uid, crop = f.crop,
            plot = f.plot.trim().take(Normalize.MAX_KEY), plotKey = Normalize.key(f.plot), cropStage = f.stage,
            description = description, core = f.core, followUps = followUps(), hadPhoto = f.photo != null,
            record = done?.record, origin = done?.origin ?: InferenceOrigin.PENDING, createdAtMillis = System.currentTimeMillis(),
            reviewStatus = ReviewStatus.NOT_STARTED, review = null,
            // Only the typed place and a ~5 km square, for a group officer's map; never an exact position.
            area = c.prefs.value.place.trim().ifEmpty { null }, cell = c.weather.cell.value,
        )
        c.repository.create(o)
        // Not finished yet: keep the photo on this phone only, to finish the check from it later.
        if (o.record == null) f.photo?.let { c.pendingPhotos.put(o.id, it) }
        if (o.record != null) c.scheduler.reviewWhenOnline(o.orgId, o.id) else c.scheduler.buildRecordWhenOnline(o.orgId, o.id)
        prefs.edit { putString(KEY_LAST_PLOT, o.plot) }
        onSaved(o.id)
    }

    private fun followUps(): List<QA> {
        val qs = (_questions.value as? QuestionsState.Ready)?.questions ?: return emptyList()
        return _form.value.answers.mapNotNull { (i, a) -> qs.getOrNull(i)?.let { QA(it.text, a.take(Normalize.MAX_ANSWER)) } }
    }

    private fun input(includeFollowUps: Boolean) = _form.value.let { f ->
        ObservationInput(f.crop, f.plot.trim(), f.stage, description, f.core, if (includeFollowUps) followUps() else emptyList(), f.photo)
    }

    private fun inputChars(f: ObserveForm) = f.description.length + f.answers.values.sumOf { it.length + 60 }
    private fun lastPlot(app: Application) = app.getSharedPreferences("observe", Application.MODE_PRIVATE).getString(KEY_LAST_PLOT, "").orEmpty()
    override fun onCleared() = speech.release()
    private companion object { const val KEY_LAST_PLOT = "last_plot" }
}

@Composable
fun ObserveScreen(vm: ObserveViewModel, farm: FarmViewModel, onDone: () -> Unit, onSaved: (String) -> Unit) {
    val step by vm.step.collectAsStateWithLifecycle()
    val form by vm.form.collectAsStateWithLifecycle()
    val questions by vm.questions.collectAsStateWithLifecycle()
    val record by vm.record.collectAsStateWithLifecycle()
    val s = strings()
    vm.language = s.english
    val c = LocalMunda.current
    BackHandler { if (!vm.back()) onDone() }
    val steps = vm.steps()
    val index = steps.indexOf(step)
    val scroll = rememberScrollState()
    LaunchedEffect(step) { scroll.scrollTo(0) }

    Column(Modifier.fillMaxSize().imePadding()) {
        PageHead(onBack = { if (!vm.back()) onDone() }, right = { ReadAloud(readText(step, questions, record, farm, s)) })
        Column(Modifier.weight(1f).verticalScroll(scroll).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally)) {
                steps.forEachIndexed { i, _ -> Box(Modifier.size(22.dp, 6.dp).clip(RoundedCornerShape(9.dp)).background(if (i <= index) c.leaf else c.rule)) }
            }
            when (step) {
                Step.DESCRIBE -> DescribeStep(vm, form)
                Step.PLOT -> PlotStep(vm, form, farm)
                Step.AREA -> Question(s.t("observe.areaTitle")) {
                    PictureTiles(AffectedArea.entries, AffectedArea.UNKNOWN, form.core.area.takeIf { it != AffectedArea.UNKNOWN }, { AreaPicture(it) }, s::area) { a -> vm.answer { it.copy(area = a) } }
                }
                Step.RAIN -> Question(s.t("observe.rainTitle")) {
                    PictureTiles(Rainfall.entries, Rainfall.UNKNOWN, form.core.rainfall.takeIf { it != Rainfall.UNKNOWN }, { RainPicture(it) }, s::rain) { r -> vm.answer { it.copy(rainfall = r) } }
                }
                Step.ONSET -> Question(s.t("observe.onsetTitle")) {
                    PictureTiles(Onset.entries, Onset.UNKNOWN, form.core.onset.takeIf { it != Onset.UNKNOWN }, { OnsetPicture(it) }, s::onset) { o -> vm.answer { it.copy(onset = o) } }
                }
                Step.FOLLOWUPS -> FollowUpsStep(vm, form, questions)
                Step.RESULT -> ResultStep(vm, record, farm, onSaved)
            }
            Spacer(Modifier.navigationBarsPadding().height(16.dp))
        }
    }
}

/** What read-aloud speaks: the question and its answers, or the leading cause and its check. */
private fun readText(step: Step, q: QuestionsState, r: RecordState, farm: FarmViewModel, s: Strings): String {
    fun list(title: String, labels: List<String>) = (listOf(title) + labels).joinToString(". ")
    return when (step) {
        Step.DESCRIBE -> list(s.t("observe.describeTitle"), listOf(s.t("observe.describeHint")))
        Step.PLOT -> s.t("observe.plotTitle")
        Step.AREA -> list(s.t("observe.areaTitle"), AffectedArea.entries.map(s::area))
        Step.RAIN -> list(s.t("observe.rainTitle"), Rainfall.entries.map(s::rain))
        Step.ONSET -> list(s.t("observe.onsetTitle"), Onset.entries.map(s::onset))
        Step.FOLLOWUPS -> (q as? QuestionsState.Ready)?.questions?.joinToString(". ") { list(it.text, it.options) }.orEmpty()
        Step.RESULT -> (r as? RecordState.Done)?.record?.possibleCauses?.firstOrNull()?.let {
            val d = farm.c.guideText.causeDisplay(it, s.lang, Guides.forCrop(Crop.MAIZE))
            listOf(s.t("result.title"), d.name, s.t("result.checkFirst"), d.check).joinToString(". ")
        }.orEmpty()
    }
}

@Composable
private fun Question(title: String, content: @Composable () -> Unit) {
    Text(title, style = MaterialTheme.typography.headlineMedium)
    content()
}

@Composable
private fun DescribeStep(vm: ObserveViewModel, form: ObserveForm) {
    val speech by vm.speechState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val c = LocalMunda.current
    val s = strings()
    var typing by remember { mutableStateOf(form.description.isNotEmpty()) }
    val mic = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { if (it) { typing = true; vm.speech.start() } }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { b -> if (b != null) vm.edit { it.copy(photo = b) } }
    val scope = rememberCoroutineScope()
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) scope.launch { loadScaledBitmap(context, uri)?.let { b -> vm.edit { it.copy(photo = b) } } }
    }
    DisposableEffect(Unit) { onDispose { vm.speech.stop() } }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(s.t("observe.describeTitle"), style = MaterialTheme.typography.headlineMedium)
        Text(s.t("observe.describeHint"), style = MaterialTheme.typography.bodyMedium, color = c.ink2)
    }
    val photo = form.photo
    if (photo != null) {
        Box(Modifier.fillMaxWidth()) {
            Image(photo.asImageBitmap(), s.t("observe.photoUsed"), Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(20.dp)), contentScale = ContentScale.Crop)
            IconButton({ vm.edit { it.copy(photo = null) } }, Modifier.align(Alignment.TopEnd).padding(8.dp).clip(CircleShape).background(c.card)) {
                Icon(Icons.Outlined.Close, s.t("observe.removePhoto"), tint = c.ink)
            }
        }
        MainButton(s.t("observe.changePhoto"), { camera.launch(null) }, kind = ButtonKind.GHOST, icon = Icons.Outlined.PhotoCamera)
    } else {
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(c.card).clickable { camera.launch(null) }.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(c.maize), contentAlignment = Alignment.Center) { Icon(Icons.Outlined.PhotoCamera, null, tint = c.forest, modifier = Modifier.size(28.dp)) }
            Column(Modifier.weight(1f)) {
                Text(s.t("observe.takePhoto"), style = MaterialTheme.typography.titleMedium)
                Text(s.t("observe.takePhotoSub"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
            }
            IconButton({ gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) { Icon(Icons.Outlined.AddPhotoAlternate, null, tint = c.ink2) }
        }
    }
    val seen by vm.seen.collectAsStateWithLifecycle()
    TextButton({ gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
        Icon(Icons.Outlined.PhotoLibrary, null, Modifier.size(18.dp), tint = c.leaf); Spacer(Modifier.width(8.dp))
        Text(s.t("observe.fromGallery"), color = c.leaf, style = MaterialTheme.typography.labelLarge)
    }
    Text(s.t("observe.photoTips"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
    when (val sn = seen) {
        Seen.Reading -> Working(s.t("observe.reading"))
        Seen.Unclear -> Text(s.t("observe.unclear"), style = MaterialTheme.typography.bodySmall, color = c.alert)
        is Seen.Suggest -> Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.leafWash).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(sn.signs, style = MaterialTheme.typography.bodyMedium)
            MainButton(s.t("observe.addSeen"), { vm.acceptSeen(sn.signs); typing = true }, kind = ButtonKind.GHOST)
        }
        else -> Unit
    }
    LaunchedEffect(seen) { if (seen == Seen.Filled) typing = true }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        @Composable fun RowScope.Duo(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector, live: Boolean, onClick: () -> Unit) = Row(
            Modifier.weight(1f).heightIn(min = 48.dp).clip(RoundedCornerShape(14.dp)).background(if (live) c.rust else c.leafWash).clickable(onClick = onClick).padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, null, Modifier.size(18.dp), tint = if (live) Color.White else c.leaf)
            Text(text, style = MaterialTheme.typography.labelLarge, color = if (live) Color.White else c.leaf)
        }
        Duo(s.t(if (speech.listening) "observe.stop" else "observe.speak"), if (speech.listening) Icons.Outlined.Stop else Icons.Outlined.Mic, speech.listening) {
            when {
                speech.listening -> vm.speech.stop()
                ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED -> { typing = true; vm.speech.start() }
                else -> mic.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
        Duo(s.t("observe.type"), Icons.Outlined.Edit, false) { typing = true }
    }
    if (typing && seen == Seen.Filled) Text(s.t("observe.seenNote"), style = MaterialTheme.typography.labelMedium, color = c.leaf)
    if (typing) OutlinedTextField(
        form.description, { v -> vm.edit { it.copy(description = v) } }, Modifier.fillMaxWidth(), minLines = 4, shape = RoundedCornerShape(14.dp),
        placeholder = { Text(s.t("observe.placeholder")) },
    )
    if (speech.listening) Text(speech.partial.ifBlank { s.t("observe.listening") }, style = MaterialTheme.typography.bodySmall, color = c.ink2)
    speech.error?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = c.alert) }
    MainButton(s.t("common.continue"), vm::next, enabled = vm.canDescribe)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PlotStep(vm: ObserveViewModel, form: ObserveForm, farm: FarmViewModel) {
    val c = LocalMunda.current
    val s = strings()
    val plots = Farm.plots(farm.items.collectAsStateWithLifecycle().value.orEmpty().map { it.observation })
    Text(s.t("observe.plotTitle"), style = MaterialTheme.typography.headlineMedium)
    if (plots.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        plots.forEach { p ->
            val on = Normalize.key(form.plot) == p.key
            Text(p.name, Modifier.clip(RoundedCornerShape(50)).background(if (on) c.forest else c.card).border(1.dp, if (on) c.forest else c.rule, RoundedCornerShape(50))
                .clickable { vm.edit { it.copy(plot = p.name) } }.padding(horizontal = 12.dp, vertical = 7.dp), style = MaterialTheme.typography.labelMedium, color = if (on) Color.White else c.ink)
        }
    }
    OutlinedTextField(
        form.plot, { v -> vm.edit { it.copy(plot = v.take(Normalize.MAX_KEY)) } }, Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(14.dp),
        placeholder = { Text(s.t(if (plots.isEmpty()) "observe.plotPlaceholder" else "observe.plotNew")) },
    )
    Tag(s.t("observe.stageTitle"), Modifier.padding(top = 8.dp))
    PictureTiles(CropStage.entries, CropStage.UNKNOWN, form.stage, { StagePicture(it) }, s::stage) { st -> vm.edit { it.copy(stage = st) } }
    MainButton(s.t("common.continue"), vm::next, enabled = form.plot.isNotBlank())
}

@Composable
private fun FollowUpsStep(vm: ObserveViewModel, form: ObserveForm, q: QuestionsState) {
    val c = LocalMunda.current
    val s = strings()
    val route by vm.route.collectAsStateWithLifecycle()
    Text(s.t("observe.followupsTitle"), style = MaterialTheme.typography.headlineMedium)
    when (q) {
        QuestionsState.Loading, QuestionsState.Idle -> Working(s.t(if (route.route == Route.ON_DEVICE) "observe.choosingOnDevice" else "observe.choosing"))
        is QuestionsState.Unavailable -> if (q.reason.isNotEmpty()) Text(s.t(if (q.reason == "unavailable") "observe.questionsUnavailable" else "observe.questionsFailed"), color = c.ink2)
        is QuestionsState.Ready -> {
            OriginBadge(q.origin)
            q.questions.forEachIndexed { i, question ->
                Text(question.text, style = MaterialTheme.typography.titleSmall)
                question.options.forEach { o ->
                    val on = form.answers[i] == o
                    Text(o, Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(if (on) c.leafWash else c.card)
                        .border(2.dp, if (on) c.leaf else c.rule, RoundedCornerShape(16.dp)).clickable { vm.edit { it.copy(answers = it.answers + (i to o)) } }.padding(14.dp),
                        style = MaterialTheme.typography.titleSmall)
                }
            }
        }
    }
    MainButton(s.t(if (route.route == Route.QUEUE_UNTIL_ONLINE) "common.continue" else "observe.showCauses"), vm::next, enabled = q !is QuestionsState.Loading)
}

@Composable
private fun ResultStep(vm: ObserveViewModel, r: RecordState, farm: FarmViewModel, onSaved: (String) -> Unit) {
    val s = strings()
    val c = LocalMunda.current
    when (r) {
        RecordState.Idle -> Working(s.t("observe.writing"))
        is RecordState.Building -> LiveResult(r, farm)
        is RecordState.Problem -> {
            // Plain words for the farmer; the technical reason stays in small print.
            Text(s.t("observe.cantFinish"), style = MaterialTheme.typography.titleMedium)
            Text("${s.t("observe.technical")}: ${r.message}", style = MaterialTheme.typography.labelSmall, color = c.ink2)
            Text(s.t("observe.queuedLede"), style = MaterialTheme.typography.bodyMedium, color = c.ink2)
            MainButton(s.t("observe.saveForLater"), { vm.save(onSaved) })
        }
        is RecordState.Done -> {
            RecordHeader(r.record, r.origin, r.latencyMs)
            CauseList(r.record.possibleCauses, { farm.c.guideText.causeDisplay(it, s.lang, Guides.forCrop(Crop.MAIZE)) }, animate = true)
            Details(r.record)
            CallOfficer(farm)
            MainButton(s.t("result.save"), { vm.save(onSaved) }, kind = ButtonKind.MAIZE)
        }
    }
}

/** The answer while the AI writes it: what's being weighed, then summary and causes as they arrive (web: LiveResult). */
@Composable
private fun LiveResult(r: RecordState.Building, farm: FarmViewModel) {
    val c = LocalMunda.current
    val s = strings()
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(100); now = System.currentTimeMillis() } }
    val preview = PartialJson.preview(r.text)
    val named = preview.causes.mapNotNull { it.guideId }.toSet()
    val writingCauses = preview.causes.isNotEmpty()
    val onDevice = r.route == Route.ON_DEVICE
    val guide = Guides.forCrop(Crop.MAIZE)

    Text(s.t("live.title"), style = MaterialTheme.typography.headlineMedium)
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(if (onDevice) c.sprout else c.skyWash).padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        val fg = if (onDevice) c.forest else c.sky
        Icon(if (onDevice) Icons.Outlined.PhoneAndroid else Icons.Outlined.Cloud, null, Modifier.size(16.dp), tint = fg)
        Text(s.t(if (onDevice) "live.onDevice" else "live.cloud"), style = MaterialTheme.typography.labelMedium, color = fg)
        Text(s.t("result.seconds", "s" to "%.1f".format((now - r.startedAt) / 1000.0)), style = MaterialTheme.typography.labelMedium, color = fg.copy(alpha = .75f))
    }
    @Composable fun LiveStep(state: Int, title: String, last: Boolean = false, body: @Composable ColumnScope.() -> Unit = {}) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier.size(26.dp).clip(CircleShape).background(if (state == 2) c.leaf2 else c.card)
                        .border(2.dp, when (state) { 2 -> c.leaf2; 1 -> c.maize; else -> c.ruleStrong }, CircleShape),
                    contentAlignment = Alignment.Center,
                ) { if (state == 2) Icon(Icons.Outlined.Check, null, Modifier.size(14.dp), tint = Color.White) }
                if (!last) Box(Modifier.width(2.dp).height(18.dp).background(if (state == 2) c.leaf2 else c.rule))
            }
            Column(Modifier.weight(1f).padding(bottom = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(title, style = MaterialTheme.typography.titleSmall.copy(fontWeight = if (state == 0) FontWeight.Normal else FontWeight.Bold), color = if (state == 0) c.ink2 else c.ink)
                body()
            }
        }
    }
    LiveStep(2, s.t("live.read"))
    @OptIn(ExperimentalLayoutApi::class)
    LiveStep(2, s.t("live.compared", "n" to r.candidates.size)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            r.candidates.forEach { e ->
                val on = e.id in named
                Text(farm.c.guideText.localized(e, s.lang).name, Modifier.clip(RoundedCornerShape(50)).background(if (on) c.husk else c.card)
                    .border(1.dp, if (on) c.maize else c.rule, RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelSmall, color = if (on) c.ink else c.ink2)
            }
        }
    }
    LiveStep(if (writingCauses) 2 else 1, s.t("live.summary")) {
        preview.summary?.let { Text(it + if (!writingCauses) " ▍" else "", Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.card).padding(12.dp), style = MaterialTheme.typography.bodyMedium) }
    }
    LiveStep(if (writingCauses) 1 else 0, s.t("live.ranking"), last = true) {
        preview.causes.forEach { lc ->
            val name = lc.guideId?.let { guide.get(it) }?.let { farm.c.guideText.localized(it, s.lang).name } ?: lc.name ?: return@forEach
            CardBox {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(name, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
                    lc.likelihood?.let { KernelMeter(it, animate = true) } ?: Working("")
                }
                if (lc.supporting.isNotEmpty() || lc.against.isNotEmpty()) Evidence(lc.supporting, lc.against)
            }
        }
    }
}

@Composable
fun RecordHeader(record: FieldRecord, origin: InferenceOrigin, latencyMs: Long? = null) {
    val c = LocalMunda.current
    val s = strings()
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(s.t("result.title"), style = MaterialTheme.typography.headlineMedium)
        Text(s.t("result.subtitle"), style = MaterialTheme.typography.bodySmall, color = c.ink2)
        Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OriginBadge(origin); UrgencyBadge(record.urgency)
            latencyMs?.let { Badge(s.t("result.seconds", "s" to "%.1f".format(it / 1000.0)), c.ink2, c.rule) }
        }
    }
}

@Composable
fun Details(record: FieldRecord) {
    val c = LocalMunda.current
    val s = strings()
    var open by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.card).clickable { open = !open }.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(s.t("common.details"), style = MaterialTheme.typography.titleSmall, color = c.leaf)
        if (open) {
            Text(record.summary, style = MaterialTheme.typography.bodyMedium)
            Text("${s.t("result.uncertainty")}: ${record.uncertaintyNote}", style = MaterialTheme.typography.bodySmall, color = c.ink2)
        }
    }
}

/** Calls the farmer's own extension officer; without one, a hint to add them on Me. */
@Composable
fun CallOfficer(farm: FarmViewModel) {
    val s = strings()
    val context = LocalContext.current
    val p by farm.prefs.collectAsStateWithLifecycle()
    val ext = p.extension
    if (ext == null || ext.phone.isBlank()) {
        Text(s.t("result.setExtension"), style = MaterialTheme.typography.bodySmall, color = LocalMunda.current.ink2)
        return
    }
    MainButton(s.t("result.callExtension") + if (ext.name.isNotBlank()) " · ${ext.name}" else "", {
        context.startActivity(android.content.Intent(android.content.Intent.ACTION_DIAL, android.net.Uri.parse("tel:" + ext.phone.filter { it.isDigit() || it == '+' })))
    }, kind = ButtonKind.GHOST, icon = Icons.Outlined.Phone)
}

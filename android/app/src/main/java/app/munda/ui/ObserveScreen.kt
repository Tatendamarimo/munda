package app.munda.ui

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import android.graphics.Bitmap
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AddPhotoAlternate
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.munda.AppContainer
import app.munda.data.inference.AiOutcome
import app.munda.data.inference.ObservationInput
import app.munda.domain.AffectedArea
import app.munda.domain.CoreAnswers
import app.munda.domain.Crop
import app.munda.domain.CropStage
import app.munda.domain.FieldRecord
import app.munda.domain.FollowUpQuestion
import app.munda.domain.InferenceOrigin
import app.munda.domain.Normalize
import app.munda.domain.Observation
import app.munda.domain.Onset
import app.munda.domain.QA
import app.munda.domain.Rainfall
import app.munda.domain.ReviewStatus
import app.munda.domain.Route
import app.munda.domain.RouteDecision
import app.munda.domain.RoutingPolicy
import app.munda.speech.SpeechCapture
import app.munda.speech.SpeechState
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class Step { DESCRIBE, QUESTIONS, RESULT }

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
    data object Loading : QuestionsState
    data class Ready(val questions: List<FollowUpQuestion>, val origin: InferenceOrigin) : QuestionsState
    data class Unavailable(val reason: String) : QuestionsState
}

sealed interface RecordState {
    data object Idle : RecordState
    data object Building : RecordState
    data class Done(val record: FieldRecord, val origin: InferenceOrigin, val latencyMs: Long) : RecordState
    data class Problem(val message: String) : RecordState
}

class ObserveViewModel(private val c: AppContainer, app: Application) : ViewModel() {
    private val _form = MutableStateFlow(ObserveForm(plot = lastPlot(app)))
    val form: StateFlow<ObserveForm> = _form.asStateFlow()
    private val _step = MutableStateFlow(Step.DESCRIBE)
    val step: StateFlow<Step> = _step.asStateFlow()
    private val _questions = MutableStateFlow<QuestionsState>(QuestionsState.Loading)
    val questions: StateFlow<QuestionsState> = _questions.asStateFlow()
    private val _record = MutableStateFlow<RecordState>(RecordState.Idle)
    val record: StateFlow<RecordState> = _record.asStateFlow()
    private val prefs = app.getSharedPreferences("observe", Application.MODE_PRIVATE)
    private var questionsJob: Job? = null

    val speech = SpeechCapture(app) { seg ->
        _form.update { f -> f.copy(description = (f.description.trimEnd() + " " + seg).trim().take(Normalize.MAX_DESCRIPTION)) }
    }
    val speechState: StateFlow<SpeechState> = speech.state

    /** Live preview of where the AI will run, shown before the farmer taps. */
    val route: StateFlow<RouteDecision> = combine(_form, c.ai.localModel, c.connectivity.online) { f, local, online ->
        RoutingPolicy.decide(inputChars(f), local.state, online, c.settings.maxOnDeviceChars)
    }.stateIn(viewModelScope, SharingStarted.Eagerly, RoutingPolicy.decide(0, c.ai.localModel.value.state, c.connectivity.online.value, c.settings.maxOnDeviceChars))

    fun edit(transform: (ObserveForm) -> ObserveForm) {
        val before = _form.value
        _form.update { transform(it).let { f -> f.copy(description = f.description.take(Normalize.MAX_DESCRIPTION)) } }
        val after = _form.value
        // Questions are tailored to the description/stage/photo; regenerate if those change.
        if (after.description != before.description || after.stage != before.stage || after.photo !== before.photo) {
            questionsJob?.cancel()
            _questions.value = QuestionsState.Loading
            _form.update { it.copy(answers = emptyMap()) }
        }
        if (_record.value !is RecordState.Building) _record.value = RecordState.Idle
    }

    val canContinue get() = _form.value.plot.isNotBlank() && _form.value.description.isNotBlank()

    fun toQuestions() {
        if (!canContinue) return
        speech.stop()
        _step.value = Step.QUESTIONS
        val decision = route.value
        if (decision.route == Route.QUEUE_UNTIL_ONLINE) {
            _questions.value = QuestionsState.Unavailable("Extra questions need the offline AI or signal. The three questions below are enough to save a good record.")
            return
        }
        if (_questions.value is QuestionsState.Ready) return // keep questions if the farmer came back
        _questions.value = QuestionsState.Loading
        questionsJob?.cancel()
        questionsJob = viewModelScope.launch {
            _questions.value = when (val out = c.ai.followUpQuestions(input(includeFollowUps = false), decision.route)) {
                is AiOutcome.Done -> if (out.value.isEmpty()) QuestionsState.Unavailable("") else QuestionsState.Ready(out.value, out.origin)
                is AiOutcome.Deferred -> QuestionsState.Unavailable("Extra questions aren't available right now.")
                is AiOutcome.Failed -> QuestionsState.Unavailable("Extra questions aren't available right now.")
            }
        }
    }

    fun back(): Boolean = when (_step.value) {
        Step.DESCRIBE -> false
        Step.QUESTIONS -> { _step.value = Step.DESCRIBE; true }
        Step.RESULT -> { _step.value = Step.QUESTIONS; _record.value = RecordState.Idle; true }
    }

    fun buildRecord() {
        if (_record.value is RecordState.Building) return
        _step.value = Step.RESULT
        val decision = route.value
        if (decision.route == Route.QUEUE_UNTIL_ONLINE) {
            _record.value = RecordState.Problem(decision.reason)
            return
        }
        _record.value = RecordState.Building
        viewModelScope.launch {
            _record.value = when (val out = c.ai.buildRecord(input(includeFollowUps = true), decision.route)) {
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
            id = c.repository.newId(s.orgId),
            orgId = s.orgId,
            ownerUid = s.uid,
            crop = f.crop,
            plot = f.plot.trim().take(Normalize.MAX_KEY),
            plotKey = Normalize.key(f.plot),
            cropStage = f.stage,
            description = f.description.trim(),
            core = f.core,
            followUps = followUps(),
            hadPhoto = f.photo != null,
            record = done?.record,
            origin = done?.origin ?: InferenceOrigin.PENDING,
            createdAtMillis = System.currentTimeMillis(),
            reviewStatus = ReviewStatus.NOT_STARTED,
            review = null,
        )
        c.repository.create(o)
        if (o.record != null) c.scheduler.reviewWhenOnline(o.orgId, o.id) else c.scheduler.buildRecordWhenOnline(o.orgId, o.id)
        prefs.edit { putString(KEY_LAST_PLOT, o.plot) }
        onSaved(o.id)
    }

    private fun followUps(): List<QA> {
        val qs = (_questions.value as? QuestionsState.Ready)?.questions ?: return emptyList()
        return _form.value.answers.mapNotNull { (i, a) -> qs.getOrNull(i)?.let { QA(it.text, a.take(Normalize.MAX_ANSWER)) } }
    }

    private fun input(includeFollowUps: Boolean) = _form.value.let { f ->
        ObservationInput(f.crop, f.plot.trim(), f.stage, f.description, f.core, if (includeFollowUps) followUps() else emptyList(), f.photo)
    }

    private fun inputChars(f: ObserveForm) = f.description.length + f.answers.values.sumOf { it.length + 60 }

    private fun lastPlot(app: Application) = app.getSharedPreferences("observe", Application.MODE_PRIVATE).getString(KEY_LAST_PLOT, "").orEmpty()

    override fun onCleared() = speech.release()

    private companion object { const val KEY_LAST_PLOT = "last_plot" }
}

@Composable
fun ObserveScreen(vm: ObserveViewModel, onDone: () -> Unit, onSaved: (String) -> Unit) {
    val step by vm.step.collectAsStateWithLifecycle()
    val c = LocalMunda.current
    BackHandler { if (!vm.back()) onDone() }
    Column(Modifier.fillMaxSize().background(c.mist).statusBarsPadding().imePadding()) {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { if (!vm.back()) onDone() }, modifier = Modifier.padding(end = 4.dp)) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, if (step == Step.DESCRIBE) "Close" else "Back", tint = c.ink)
                }
                Stepper(step.ordinal, Modifier.weight(1f))
            }
            Text(
                when (step) { Step.DESCRIBE -> "What do you see?"; Step.QUESTIONS -> "A few questions"; Step.RESULT -> "Possible causes" },
                style = MaterialTheme.typography.headlineMedium, color = c.ink,
            )
            when (step) {
                Step.DESCRIBE -> DescribeStep(vm)
                Step.QUESTIONS -> QuestionsStep(vm)
                Step.RESULT -> ResultStep(vm, onSaved)
            }
            Box(Modifier.navigationBarsPadding())
        }
    }
}

@Composable
private fun PrimaryButton(text: String, enabled: Boolean = true, onClick: () -> Unit) {
    val c = LocalMunda.current
    Button(
        onClick = onClick, enabled = enabled, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp), shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = c.leaf, contentColor = c.onLeaf),
    ) { Text(text, style = MaterialTheme.typography.labelLarge) }
}

@Composable
private fun Tool(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector, live: Boolean = false, onClick: () -> Unit) {
    val c = LocalMunda.current
    Surface(
        onClick = onClick, shape = RoundedCornerShape(8.dp), color = if (live) c.alert else c.paper,
        border = BorderStroke(1.dp, if (live) c.alert else c.ruleStrong), modifier = Modifier.heightIn(min = 40.dp),
    ) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(icon, null, Modifier.size(16.dp), tint = if (live) androidx.compose.ui.graphics.Color.White else c.ink)
            Text(text, style = MaterialTheme.typography.labelMedium, color = if (live) androidx.compose.ui.graphics.Color.White else c.ink)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DescribeStep(vm: ObserveViewModel) {
    val form by vm.form.collectAsStateWithLifecycle()
    val speech by vm.speechState.collectAsStateWithLifecycle()
    val route by vm.route.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val c = LocalMunda.current
    val mic = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { if (it) vm.speech.start() }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { b -> if (b != null) vm.edit { it.copy(photo = b) } }
    val scope = rememberCoroutineScope()
    // System photo picker: no storage permission needed.
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) scope.launch { loadScaledBitmap(context, uri)?.let { b -> vm.edit { it.copy(photo = b) } } }
    }
    DisposableEffect(Unit) { onDispose { vm.speech.stop() } }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = c.leaf, unfocusedBorderColor = c.ruleStrong, focusedContainerColor = c.paper, unfocusedContainerColor = c.paper,
    )

    Column(verticalArrangement = Arrangement.spacedBy(22.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Plot", style = MaterialTheme.typography.titleSmall, color = c.ink)
            OutlinedTextField(
                value = form.plot, onValueChange = { v -> vm.edit { it.copy(plot = v.take(Normalize.MAX_KEY)) } },
                placeholder = { Text("River plot") }, singleLine = true, shape = RoundedCornerShape(12.dp), colors = fieldColors,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        ChoiceGroup("Crop stage", CropStage.entries, form.stage, { it.label }) { s -> vm.edit { it.copy(stage = s) } }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("What you see", style = MaterialTheme.typography.titleSmall, color = c.ink)
            Column(Modifier.clip(RoundedCornerShape(12.dp)).border(1.5.dp, c.ruleStrong, RoundedCornerShape(12.dp)).background(c.paper)) {
                OutlinedTextField(
                    value = form.description, onValueChange = { v -> vm.edit { it.copy(description = v) } },
                    placeholder = { Text("The lower leaves are yellow and the plants are small.") }, minLines = 5,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = androidx.compose.ui.graphics.Color.Transparent, unfocusedBorderColor = androidx.compose.ui.graphics.Color.Transparent),
                    modifier = Modifier.fillMaxWidth(),
                )
                HorizontalDivider(color = c.rule)
                FlowRow(
                    Modifier.fillMaxWidth().background(c.mist).padding(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Tool(if (speech.listening) "Stop" else "Dictate", if (speech.listening) Icons.Outlined.Stop else Icons.Outlined.Mic, live = speech.listening) {
                        when {
                            speech.listening -> vm.speech.stop()
                            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED -> vm.speech.start()
                            else -> mic.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    }
                    Tool(if (form.photo == null) "Take photo" else "Retake", Icons.Outlined.PhotoCamera) { camera.launch(null) }
                    Tool("Gallery", Icons.Outlined.AddPhotoAlternate) { gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
                    form.photo?.let { bmp ->
                        Box {
                            Image(bmp.asImageBitmap(), "Leaf photo", Modifier.size(44.dp).clip(RoundedCornerShape(8.dp)), contentScale = ContentScale.Crop)
                            Surface(onClick = { vm.edit { it.copy(photo = null) } }, shape = CircleShape, color = c.ink, modifier = Modifier.align(Alignment.TopEnd).size(22.dp)) {
                                Icon(Icons.Outlined.Close, "Remove photo", tint = c.paper, modifier = Modifier.padding(4.dp))
                            }
                        }
                    }
                }
            }
            if (speech.listening) Text(speech.partial.ifBlank { "Listening…" }, style = MaterialTheme.typography.bodySmall, color = c.ink2)
            speech.error?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = c.alert) }
        }
        RouteNote(route)
        PrimaryButton("Continue", enabled = vm.canContinue) { vm.toQuestions() }
    }
}

@Composable
private fun QuestionsStep(vm: ObserveViewModel) {
    val form by vm.form.collectAsStateWithLifecycle()
    val qs by vm.questions.collectAsStateWithLifecycle()
    val route by vm.route.collectAsStateWithLifecycle()
    val c = LocalMunda.current
    Column(verticalArrangement = Arrangement.spacedBy(22.dp)) {
        ChoiceGroup("How much of the plot is affected?", AffectedArea.entries, form.core.area, { it.label }) { a -> vm.edit { it.copy(core = it.core.copy(area = a)) } }
        ChoiceGroup("Rain in the last two weeks?", Rainfall.entries, form.core.rainfall, { it.label }) { r -> vm.edit { it.copy(core = it.core.copy(rainfall = r)) } }
        ChoiceGroup("When did you first notice it?", Onset.entries, form.core.onset, { it.label }) { o -> vm.edit { it.copy(core = it.core.copy(onset = o)) } }
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(c.leafWash).padding(18.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            when (val q = qs) {
                QuestionsState.Loading -> Working(if (route.route == Route.ON_DEVICE) "Munda is choosing questions on this phone" else "Munda is choosing questions")
                is QuestionsState.Ready -> {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Munda also asks", style = MaterialTheme.typography.titleMedium, color = c.ink, modifier = Modifier.weight(1f))
                        OriginBadge(q.origin)
                    }
                    q.questions.forEachIndexed { i, question ->
                        ChoiceGroup(question.text, question.options, form.answers[i], { it }) { a -> vm.edit { it.copy(answers = it.answers + (i to a)) } }
                    }
                }
                is QuestionsState.Unavailable -> if (q.reason.isNotBlank()) Text(q.reason, style = MaterialTheme.typography.bodySmall, color = c.ink2)
            }
        }
        RouteNote(route)
        PrimaryButton(if (route.route == Route.QUEUE_UNTIL_ONLINE) "Continue" else "Show possible causes") { vm.buildRecord() }
    }
}

@Composable
private fun ResultStep(vm: ObserveViewModel, onSaved: (String) -> Unit) {
    val rec by vm.record.collectAsStateWithLifecycle()
    val c = LocalMunda.current
    when (val r = rec) {
        RecordState.Idle, RecordState.Building -> Working("Writing your field record")
        is RecordState.Problem -> Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(r.message, style = MaterialTheme.typography.bodyLarge, color = c.ink)
            Text("Your description and answers are saved now. Munda writes the field record when you’re back online.", style = MaterialTheme.typography.bodyMedium, color = c.ink)
            OutlinedButton(onClick = { vm.save(onSaved) }, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp), shape = RoundedCornerShape(12.dp), border = BorderStroke(1.5.dp, c.leaf)) {
                Text("Save for later", color = c.leaf, style = MaterialTheme.typography.labelLarge)
            }
        }
        is RecordState.Done -> Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Badges {
                OriginBadge(r.origin)
                UrgencyBadge(r.record.urgency)
                Badge("%.1f s".format(r.latencyMs / 1000.0), c.ink2, c.ink2.copy(alpha = .12f))
            }
            Text(r.record.summary, style = MaterialTheme.typography.titleLarge, color = c.ink)
            UncertaintyNote(r.record.uncertaintyNote)
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) { r.record.possibleCauses.forEach { CauseEntry(it, animate = true) } }
            PrimaryButton("Save field record") { vm.save(onSaved) }
        }
    }
}

@Composable
private fun RouteNote(route: RouteDecision) {
    val c = LocalMunda.current
    val bar = when (route.route) { Route.ON_DEVICE -> androidx.compose.ui.graphics.Color(0xFF2E8B57); Route.CLOUD -> c.sky; Route.QUEUE_UNTIL_ONLINE -> c.ruleStrong }
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        Box(Modifier.width(3.dp).fillMaxSize().background(bar))
        Text(route.reason, style = MaterialTheme.typography.bodySmall, color = c.ink2, modifier = Modifier.padding(start = 12.dp))
    }
}

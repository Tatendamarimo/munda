package app.munda.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.munda.AppContainer
import app.munda.data.Group
import app.munda.data.GroupAlert
import app.munda.data.ObservationItem
import app.munda.work.AlertWorker
import app.munda.data.Prefs
import app.munda.data.SessionState
import app.munda.data.inference.LocalModelInfo
import app.munda.domain.InferenceOrigin
import app.munda.domain.ReviewStatus
import app.munda.domain.Weather
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** A cloud history review that just arrived, for the "review added" banner. */
data class ReviewAdded(val id: String, val plot: String, val at: Long)

/**
 * The farm every tab shows: session, this farm's records, connection, offline AI, the farmer's
 * settings and weather. One instance for the whole app, like the web's shared stores.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class FarmViewModel(val c: AppContainer) : ViewModel() {
    val session: StateFlow<SessionState> = c.session.state
    val account = c.session.account
    private val _accountBusy = MutableStateFlow(false)
    val accountBusy = _accountBusy.asStateFlow()
    private val _accountProblem = MutableStateFlow<String?>(null)
    val accountProblem = _accountProblem.asStateFlow()
    private val _accountNotice = MutableStateFlow<String?>(null)
    val accountNotice = _accountNotice.asStateFlow()
    val online: StateFlow<Boolean> = c.connectivity.online
    val localModel: StateFlow<LocalModelInfo> = c.ai.localModel
    val prefs: StateFlow<Prefs> = c.prefs.state
    val weather: StateFlow<Weather?> = c.weather.weather
    val placeNotFound: StateFlow<String?> = c.weather.placeNotFound

    private val scheduled = mutableSetOf<String>()
    private var seenReviews: Map<String, ReviewStatus>? = null
    private val _reviewAdded = MutableStateFlow<ReviewAdded?>(null)
    val reviewAdded: StateFlow<ReviewAdded?> = _reviewAdded.asStateFlow()

    val group: StateFlow<Group?> = c.groups.group
    private val _groupProblem = MutableStateFlow<String?>(null)
    val groupProblem: StateFlow<String?> = _groupProblem.asStateFlow()

    /** Confirmed alerts from the group's officer, newest first. */
    val alerts: StateFlow<List<GroupAlert>> = c.groups.group
        .flatMapLatest { g -> if (g == null) flowOf(emptyList()) else c.groups.alerts(g.orgId) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    // In a group the farm holds everyone's checks; a farmer's own screens show only theirs (web: useObservations).
    val items: StateFlow<List<ObservationItem>?> = c.session.state
        .flatMapLatest { s -> if (s is SessionState.Ready) c.repository.observeRecent(s.orgId).map { l -> l.filter { it.observation.ownerUid == s.uid } } else emptyFlow() }
        .onEach { reconcileBackgroundWork(it); noticeReviews(it) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    init {
        viewModelScope.launch { c.ai.refreshLocalStatus() }
        viewModelScope.launch { c.weather.refresh() }
        viewModelScope.launch { online.collect { if (it) c.weather.refresh() } }
    }

    fun activate() = viewModelScope.launch {
        c.session.activate()

    }

    fun setupName(value: String) = c.prefs.update { it.copy(name = value.take(40)) }
    fun setupPlace(value: String) = c.prefs.update { it.copy(place = value.take(40)) }
    fun setupStep(step: Int) { _accountProblem.value = null; c.prefs.update { it.copy(setupStep = step.coerceIn(0, 4)) } }
    fun finishSetup() {
        val uid = c.session.ready?.uid ?: return
        c.prefs.update { it.copy(setupStep = 0, setupCompletedUids = (it.setupCompletedUids.filterNot { old -> old == uid } + uid).takeLast(20)) }
    }
    fun guestSetup() = viewModelScope.launch {
        if (_accountBusy.value) return@launch
        _accountBusy.value = true; _accountProblem.value = null
        try { if (c.session.ready == null) c.session.activate(); if (c.session.ready != null) setupStep(2) else _accountProblem.value = "auth.network" }
        finally { _accountBusy.value = false }
    }
    private fun accountAction(action: suspend () -> Unit) = viewModelScope.launch {
        if (_accountBusy.value) return@launch
        _accountBusy.value = true; _accountProblem.value = null; _accountNotice.value = null
        try { action() } catch (e: Exception) { _accountProblem.value = app.munda.data.Session.issue(e) }
        finally { _accountBusy.value = false }
    }
    fun createEmail(email: String, password: String, onDone: () -> Unit) = accountAction { c.session.createEmail(email, password); onDone() }
    fun signInEmail(email: String, password: String, onDone: () -> Unit) = accountAction { c.session.signInEmail(email, password); onDone() }
    fun resetPassword(email: String) = accountAction {
        try { c.session.resetPassword(email) } catch (e: com.google.firebase.auth.FirebaseAuthException) { if (e.errorCode != "ERROR_USER_NOT_FOUND") throw e }
        _accountNotice.value = "auth.resetSent"
    }
    fun verifyEmail() = accountAction { c.session.verifyEmail(); _accountNotice.value = "auth.verifySent" }
    fun refreshAccount() = accountAction { c.session.refreshAccount() }

    fun downloadModel() = viewModelScope.launch { c.ai.ensureLocalModel() }

    /** Joining needs signal once: the rules check the group exists. */
    fun joinGroup(code: String) = viewModelScope.launch {
        val s = c.session.privateReady ?: return@launch
        _groupProblem.value = null
        if (!online.value) { _groupProblem.value = "group.needsSignal"; return@launch }
        runCatching { c.groups.join(s.uid, code, c.prefs.value.name) }
            .onSuccess { AlertWorker.schedule(c.app) }
            .onFailure { _groupProblem.value = "group.notFound" }
    }

    fun leaveGroup() = viewModelScope.launch {
        val s = c.session.privateReady ?: return@launch
        c.groups.leave(s.uid); AlertWorker.cancel(c.app)
    }

    fun setLanguage(lang: String) = c.prefs.update { it.copy(lang = lang) }
    fun setName(name: String) = c.prefs.update { it.copy(name = name.trim().take(40)) }
    fun setPlace(place: String) {
        if (place.trim() == c.prefs.value.place) return
        c.prefs.update { it.copy(place = place.trim().take(40)) }
        viewModelScope.launch { c.weather.refresh(force = true) }
    }
    fun setWeather(on: Boolean) {
        c.prefs.update { it.copy(weatherOn = on) }
        if (on) viewModelScope.launch { c.weather.refresh(force = true) } else c.weather.clear()
    }
    fun setExtension(name: String, phone: String) = c.prefs.update {
        it.copy(extension = if (name.isBlank() && phone.isBlank()) null else app.munda.data.Extension(name.trim().take(40), phone.trim().take(24)))
    }
    fun setPlanted(plotKey: String, at: Long?) = c.prefs.update {
        it.copy(plantedAt = if (at == null) it.plantedAt - plotKey else it.plantedAt + (plotKey to at))
    }

    /** A review landing on a record we'd seen without one: show the banner for a few seconds. */
    private fun noticeReviews(items: List<ObservationItem>) {
        val now = items.associate { it.observation.id to it.observation.reviewStatus }
        val before = seenReviews
        if (before != null) {
            items.firstOrNull { before[it.observation.id] == ReviewStatus.NOT_STARTED && it.observation.reviewStatus == ReviewStatus.DONE }
                ?.let { _reviewAdded.value = ReviewAdded(it.observation.id, it.observation.plot, System.currentTimeMillis()) }
        }
        seenReviews = now
    }

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

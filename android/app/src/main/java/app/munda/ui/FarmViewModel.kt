package app.munda.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.munda.AppContainer
import app.munda.data.ObservationItem
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
    val online: StateFlow<Boolean> = c.connectivity.online
    val localModel: StateFlow<LocalModelInfo> = c.ai.localModel
    val prefs: StateFlow<Prefs> = c.prefs.state
    val weather: StateFlow<Weather?> = c.weather.weather
    val placeNotFound: StateFlow<String?> = c.weather.placeNotFound

    private val scheduled = mutableSetOf<String>()
    private var seenReviews: Map<String, ReviewStatus>? = null
    private val _reviewAdded = MutableStateFlow<ReviewAdded?>(null)
    val reviewAdded: StateFlow<ReviewAdded?> = _reviewAdded.asStateFlow()

    val items: StateFlow<List<ObservationItem>?> = c.session.state
        .flatMapLatest { s -> if (s is SessionState.Ready) c.repository.observeRecent(s.orgId) else emptyFlow() }
        .onEach { reconcileBackgroundWork(it); noticeReviews(it) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    init {
        viewModelScope.launch { if (c.session.ready != null) c.ai.ensureLocalModel() else c.ai.refreshLocalStatus() }
        viewModelScope.launch { c.weather.refresh() }
        viewModelScope.launch { online.collect { if (it) c.weather.refresh() } }
    }

    fun activate() = viewModelScope.launch {
        c.session.activate()
        if (c.session.ready != null) c.ai.ensureLocalModel()
    }

    fun downloadModel() = viewModelScope.launch { c.ai.ensureLocalModel() }

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

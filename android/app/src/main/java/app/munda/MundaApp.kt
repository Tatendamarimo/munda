package app.munda

import android.app.Application
import app.munda.data.Connectivity
import app.munda.data.GroupRepo
import app.munda.data.PendingPhotos
import app.munda.data.PrefsStore
import app.munda.data.WeatherRepo
import app.munda.domain.GuideText
import app.munda.domain.MaizeGuide
import app.munda.i18n.I18n
import app.munda.data.ObservationRepository
import app.munda.data.RemoteSettings
import app.munda.data.Session
import app.munda.data.inference.HistoryReviewer
import app.munda.data.inference.MundaAi
import app.munda.security.AppCheckInstaller
import app.munda.work.WorkScheduler
import com.google.firebase.Firebase
import com.google.firebase.firestore.firestore
import com.google.firebase.firestore.firestoreSettings
import com.google.firebase.firestore.persistentCacheSettings
import com.google.firebase.initialize

/** Manual DI: the graph is small enough that a framework would cost more than it saves. */
class AppContainer(val app: Application) {
    init {
        // The guide is shared/guides/maize.json, the same file the web app reads.
        MaizeGuide.source = { app.assets.open("guides/maize.json").bufferedReader().use { it.readText() } }
    }

    /** The web app's text and guide translations, from shared/ (bundled as assets). */
    val i18n = I18n.load { name -> app.assets.open("i18n/$name").bufferedReader().use { it.readText() } }
    val guideText = GuideText.load { name -> runCatching { app.assets.open("guides/i18n/$name").bufferedReader().use { it.readText() } }.getOrNull() }
    val prefs = PrefsStore(app)
    val pendingPhotos = PendingPhotos(app)
    val connectivity = Connectivity(app)
    val weather = WeatherRepo(app, prefs, connectivity)
    val settings = RemoteSettings()
    val groups = GroupRepo(app)
    val session = Session(app, groups.group)
    val repository = ObservationRepository()
    val ai = MundaAi(settings, connectivity)
    val reviewer = HistoryReviewer(settings, repository) { prefs.value.lang?.let { i18n.info(it).english } }
    val scheduler = WorkScheduler(app)
}

class MundaApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        Firebase.initialize(this)
        // Must precede any Firebase AI Logic call; AI Logic enforces App Check.
        AppCheckInstaller.install()
        Firebase.firestore.firestoreSettings = firestoreSettings {
            // A season of observations and queued writes fits easily in 100 MB.
            setLocalCacheSettings(persistentCacheSettings { setSizeBytes(100L * 1024 * 1024) })
        }
        container = AppContainer(this)
        container.settings.refresh()
    }
}

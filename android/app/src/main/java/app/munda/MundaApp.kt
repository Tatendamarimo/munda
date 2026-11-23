package app.munda

import android.app.Application
import app.munda.data.Connectivity
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
class AppContainer(app: Application) {
    val connectivity = Connectivity(app)
    val settings = RemoteSettings()
    val session = Session(app)
    val repository = ObservationRepository()
    val ai = MundaAi(settings, connectivity)
    val reviewer = HistoryReviewer(settings, repository)
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

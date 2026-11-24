package app.munda.data

import android.content.Context
import android.util.Log
import androidx.core.content.edit
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await

sealed interface SessionState {
    data object Loading : SessionState
    /** Device has never been activated; needs one online sign-in before working offline. */
    data object NeedsActivation : SessionState
    data object Activating : SessionState
    data class Ready(val uid: String, val orgId: String) : SessionState
    data class Error(val message: String) : SessionState
}

/**
 * Tenancy comes from an `orgId` custom claim (set by an admin backend for cooperatives and
 * extension groups). Without one, a user has a private farm of their own, `u-<uid>`, matching
 * myOrg() in firestore.rules and orgFor() on the web. Cached locally so it works offline.
 */
class Session(context: Context, private val group: StateFlow<Group?>) {
    private val auth = Firebase.auth
    private val prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)
    private val base = MutableStateFlow<SessionState>(SessionState.Loading)
    private val _state = MutableStateFlow<SessionState>(SessionState.Loading)
    /** While in a group, new checks go to the group's farm (web: session.ts). */
    val state: StateFlow<SessionState> = _state.asStateFlow()
    private fun publish() {
        val b = base.value
        _state.value = if (b is SessionState.Ready) b.copy(orgId = group.value?.orgId ?: b.orgId) else b
    }
    /** The user's own farm, whatever group they are in. */
    val privateReady: SessionState.Ready? get() = base.value as? SessionState.Ready

    init {
        val user = auth.currentUser
        val cachedOrg = prefs.getString(KEY_ORG, null)
        base.value = if (user != null && cachedOrg != null) {
            // A cached "demo" (from before private farms) becomes the private farm.
            val org = orgFor(user.uid, cachedOrg)
            if (org != cachedOrg) prefs.edit { putString(KEY_ORG, org) }
            SessionState.Ready(user.uid, org)
        } else SessionState.NeedsActivation
        publish()
        CoroutineScope(SupervisorJob() + Dispatchers.Default).launch { group.collect { publish() } }
    }

    val ready: SessionState.Ready? get() = _state.value as? SessionState.Ready

    suspend fun activate() {
        if (base.value is SessionState.Activating) return
        base.value = SessionState.Activating; publish()
        base.value = try {
            val user = auth.currentUser ?: auth.signInAnonymously().await().user
                ?: error("Sign-in returned no user")
            val claims = user.getIdToken(true).await().claims
            val orgId = orgFor(user.uid, claims["orgId"] as? String)
            prefs.edit { putString(KEY_ORG, orgId) }
            SessionState.Ready(user.uid, orgId)
        } catch (e: Exception) {
            Log.w(TAG, "Activation failed", e)
            SessionState.Error("Couldn't activate. Connect to the internet once and try again.")
        }
        publish()
    }

    companion object {
        private const val TAG = "Session"
        private const val KEY_ORG = "org_id"
        /** The old shared farm everyone without a group used to land in. */
        private const val LEGACY_SHARED_ORG = "demo"

        fun orgFor(uid: String, claim: String?): String =
            claim?.takeIf { it.isNotBlank() && it != LEGACY_SHARED_ORG } ?: "u-$uid"
    }
}

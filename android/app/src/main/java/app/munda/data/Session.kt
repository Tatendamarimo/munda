package app.munda.data

import android.content.Context
import android.util.Log
import androidx.core.content.edit
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
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
 * Tenancy comes from an `orgId` custom claim (set by an admin backend for real farm groups).
 * Without one, users land in the shared "demo" org, which mirrors the default in
 * firestore.rules. The org is cached locally so the app keeps working offline.
 */
class Session(context: Context) {
    private val auth = Firebase.auth
    private val prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)
    private val _state = MutableStateFlow<SessionState>(SessionState.Loading)
    val state: StateFlow<SessionState> = _state.asStateFlow()

    init {
        val user = auth.currentUser
        val cachedOrg = prefs.getString(KEY_ORG, null)
        _state.value = if (user != null && cachedOrg != null) SessionState.Ready(user.uid, cachedOrg)
        else SessionState.NeedsActivation
    }

    val ready: SessionState.Ready? get() = _state.value as? SessionState.Ready

    suspend fun activate() {
        if (_state.value is SessionState.Activating) return
        _state.value = SessionState.Activating
        _state.value = try {
            val user = auth.currentUser ?: auth.signInAnonymously().await().user
                ?: error("Sign-in returned no user")
            val claims = user.getIdToken(true).await().claims
            val orgId = (claims["orgId"] as? String)?.takeIf { it.isNotBlank() } ?: DEFAULT_ORG
            prefs.edit { putString(KEY_ORG, orgId) }
            SessionState.Ready(user.uid, orgId)
        } catch (e: Exception) {
            Log.w(TAG, "Activation failed", e)
            SessionState.Error("Couldn't activate. Connect to the internet once and try again.")
        }
    }

    private companion object {
        const val TAG = "Session"
        const val KEY_ORG = "org_id"
        const val DEFAULT_ORG = "demo"
    }
}

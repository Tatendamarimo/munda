package app.munda.security

import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory

/**
 * Debug builds: the debug provider logs a token to Logcat (tag "DebugAppCheckProvider").
 * Register it in Firebase console > App Check > Apps > Manage debug tokens.
 * Never commit that token; it grants API access to anyone holding it.
 */
object AppCheckInstaller {
    fun install() {
        Firebase.appCheck.installAppCheckProviderFactory(DebugAppCheckProviderFactory.getInstance())
    }
}

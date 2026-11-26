package app.munda.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.munda.R
import app.munda.data.SessionState

/** One-time, resumable setup, with optional personal details and explicit location permission. */
@Composable
fun OnboardingScreen(vm: FarmViewModel) {
    val s = strings()
    val p by vm.prefs.collectAsStateWithLifecycle()
    val session by vm.session.collectAsStateWithLifecycle()
    val online by vm.online.collectAsStateWithLifecycle()
    val local by vm.localModel.collectAsStateWithLifecycle()
    val step = if (session !is SessionState.Ready && p.setupStep > 1) 1 else p.setupStep.coerceIn(0, 4)
    val keys = listOf("language", "account", "name", "area", "readiness")
    Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Image(painterResource(R.drawable.munda_wordmark), "Munda", Modifier.width(120.dp).height(40.dp))
            Text(s.t("setup.step", "n" to step + 1, "total" to 5), style = MaterialTheme.typography.labelMedium)
        }
        LinearProgressIndicator(progress = { (step + 1) / 5f }, modifier = Modifier.fillMaxWidth())
        Eyebrow(s.t("studio.companion"), LocalMunda.current.leaf)
        Text(s.t("setup.${keys[step]}"), style = MaterialTheme.typography.headlineLarge)
        Text(s.t("setup.${keys[step]}Help"), style = MaterialTheme.typography.bodyLarge, color = LocalMunda.current.ink2)
        if (session is SessionState.Loading) Working(s.t("common.loading")) else when (step) {
            0 -> {
                s.i18n.langs.forEach { l ->
                    FilterChip(selected = l.code == s.lang, onClick = { vm.setLanguage(l.code) }, label = { Text(l.native + if (l.beta) " · ${s.t("common.beta")}" else "") }, modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp))
                }
                MainButton(s.t("setup.next"), { vm.setupStep(1) })
            }
            1 -> AccountPanel(vm, allowGuest = true, onDone = { vm.setupStep(2) })
            2 -> {
                OutlinedTextField(p.name, { vm.setupName(it) }, Modifier.fillMaxWidth(), label = { Text(s.t("me.name")) }, placeholder = { Text(s.t("setup.namePlaceholder")) }, singleLine = true)
                MainButton(s.t("setup.next"), { vm.setName(p.name); vm.setupStep(3) })
                TextButton({ vm.setName(p.name); vm.setupStep(3) }) { Text(s.t("setup.skip")) }
            }
            3 -> {
                OutlinedTextField(p.place, { vm.setupPlace(it) }, Modifier.fillMaxWidth(), label = { Text(s.t("me.place")) }, placeholder = { Text(s.t("setup.areaPlaceholder")) }, singleLine = true)
                LocationButton(vm)
                MainButton(s.t("setup.next"), { vm.setPlace(p.place); vm.setupStep(4) })
                TextButton({ vm.setPlace(p.place); vm.setupStep(4) }) { Text(s.t("setup.skip")) }
            }
            4 -> {
                CardBox { StatusDetails(online, local, vm::downloadModel) }
                Text(s.t("setup.readyGuide"), style = MaterialTheme.typography.bodyMedium)
                if (local.state == app.munda.domain.LocalModelState.DOWNLOADABLE || local.state == app.munda.domain.LocalModelState.DOWNLOADING) Text(s.t("setup.downloadHelp"), style = MaterialTheme.typography.bodySmall, color = LocalMunda.current.ink2)
                MainButton(s.t("setup.enter"), vm::finishSetup)
            }
        }
        if (step > 0) TextButton({ vm.setupStep(step - 1) }) { Text(s.t("setup.back")) }
        Text(s.t("setup.saved"), style = MaterialTheme.typography.bodySmall, color = LocalMunda.current.ink2)
    }
}

/** Same email identity on Android and web. Passwords deliberately use remember, never rememberSaveable. */
@Composable
fun AccountPanel(vm: FarmViewModel, allowGuest: Boolean = false, onDone: () -> Unit = {}) {
    val s = strings()
    val identity by vm.account.collectAsStateWithLifecycle()
    val online by vm.online.collectAsStateWithLifecycle()
    val busy by vm.accountBusy.collectAsStateWithLifecycle()
    val problem by vm.accountProblem.collectAsStateWithLifecycle()
    val notice by vm.accountNotice.collectAsStateWithLifecycle()
    var mode by rememberSaveable { mutableStateOf("choice") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var show by remember { mutableStateOf(false) }
    var mismatch by remember { mutableStateOf(false) }
    val member = identity.uid != null && !identity.anonymous
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (member) {
            Text(s.t("auth.member"), style = MaterialTheme.typography.titleMedium)
            Text(identity.email.orEmpty())
            Text(s.t("auth.createHelp"), style = MaterialTheme.typography.bodySmall, color = LocalMunda.current.ink2)
            if (identity.verified) Text(s.t("auth.verified"), color = LocalMunda.current.leaf) else {
                Text(s.t("auth.verificationNeeded"), style = MaterialTheme.typography.bodySmall)
                MainButton(s.t("auth.verify"), { vm.verifyEmail() }, enabled = online && !busy, kind = ButtonKind.GHOST)
                TextButton({ vm.refreshAccount() }, enabled = online && !busy) { Text(s.t("auth.refresh")) }
            }
            if (allowGuest) MainButton(s.t("common.continue"), onDone)
        } else if (mode == "choice") {
            if (allowGuest) {
                MainButton(s.t("setup.guest"), { vm.guestSetup() }, enabled = (online || identity.uid != null) && !busy)
                Text(s.t("setup.guestHelp"), style = MaterialTheme.typography.bodySmall, color = LocalMunda.current.ink2)
            } else Text(s.t("auth.protectHelp"), style = MaterialTheme.typography.bodyMedium)
            MainButton(s.t(if (identity.uid != null) "auth.protect" else "auth.create"), { mode = "create" }, enabled = online && !busy, kind = ButtonKind.GHOST)
            if (identity.uid == null) TextButton({ mode = "signIn" }, enabled = online && !busy) { Text(s.t("auth.signIn")) }
        } else {
            Text(s.t(if (mode == "reset") "auth.forgot" else if (mode == "signIn") "auth.signIn" else "auth.create"), style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(email, { email = it.take(254) }, Modifier.fillMaxWidth(), enabled = !busy, label = { Text(s.t("auth.email")) }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
            if (mode != "reset") {
                OutlinedTextField(password, { password = it.take(128) }, Modifier.fillMaxWidth(), enabled = !busy, label = { Text(s.t("auth.password")) }, singleLine = true, visualTransformation = if (show) VisualTransformation.None else PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
                if (mode == "create") {
                    Text(s.t("auth.passwordHelp"), style = MaterialTheme.typography.bodySmall)
                    OutlinedTextField(confirm, { confirm = it.take(128); mismatch = false }, Modifier.fillMaxWidth(), enabled = !busy, label = { Text(s.t("auth.confirm")) }, singleLine = true, visualTransformation = if (show) VisualTransformation.None else PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
                }
                Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(show, { show = it }); Text(s.t("auth.showPassword"), style = MaterialTheme.typography.bodySmall) }
            }
            val valid = android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches() && (mode == "reset" || password.length >= if (mode == "create") 8 else 1)
            MainButton(s.t(if (mode == "reset") "auth.reset" else if (mode == "signIn") "auth.signIn" else "auth.create"), {
                if (mode == "create" && password != confirm) mismatch = true
                else if (mode == "reset") vm.resetPassword(email)
                else {
                    val done = { password = ""; confirm = ""; mode = "choice"; onDone() }
                    if (mode == "signIn") vm.signInEmail(email, password, done) else vm.createEmail(email, password, done)
                }
            }, enabled = online && !busy && valid)
            if (mode == "signIn") TextButton({ mode = "reset"; password = ""; confirm = "" }, enabled = !busy) { Text(s.t("auth.forgot")) }
            TextButton({ mode = "choice"; password = ""; confirm = ""; mismatch = false }, enabled = !busy) { Text(s.t("auth.cancel")) }
        }
        if (!online) Text(s.t("auth.needSignal"), style = MaterialTheme.typography.bodySmall, color = LocalMunda.current.ink2)
        if (mismatch) Text(s.t("auth.mismatch"), color = LocalMunda.current.alert)
        problem?.let { Text(s.t(it), color = LocalMunda.current.alert) }
        notice?.let { Text(s.t(it), color = LocalMunda.current.leaf) }
        if (busy) Working(s.t("common.loading"))
    }
}

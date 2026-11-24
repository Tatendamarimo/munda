package app.munda

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Eco
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import app.munda.data.SessionState
import app.munda.data.Voice
import app.munda.ui.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as MundaApp
        val voice = Voice(this, app.container.settings, app.container.connectivity)
        setContent {
            MundaTheme {
                val farm: FarmViewModel = viewModel { FarmViewModel(app.container) }
                val prefs by farm.prefs.collectAsStateWithLifecycle()
                val online by farm.online.collectAsStateWithLifecycle()
                val lang = prefs.lang ?: app.container.i18n.langs.map { it.code }.firstOrNull { it == java.util.Locale.getDefault().language } ?: "en"
                CompositionLocalProvider(
                    LocalStrings provides Strings(app.container.i18n, lang), LocalVoice provides voice, LocalOnline provides online,
                ) {
                    val session by farm.session.collectAsStateWithLifecycle()
                    Surface(Modifier.fillMaxSize(), color = LocalMunda.current.mist) {
                        if (session !is SessionState.Ready) WelcomeScreen(farm) else MundaNav(farm, app)
                    }
                }
            }
        }
    }
}

private data class Tab(val route: String, val key: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)
private val TABS = listOf(Tab("home", "tabs.home", Icons.Outlined.Home), Tab("plots", "tabs.plots", Icons.Outlined.Eco), Tab("guide", "tabs.guide", Icons.Outlined.MenuBook), Tab("me", "tabs.me", Icons.Outlined.Person))

@Composable
private fun MundaNav(farm: FarmViewModel, app: MundaApp) {
    val nav = rememberNavController()
    val current = nav.currentBackStackEntryAsState().value?.destination?.route
    val s = strings()
    val online by farm.online.collectAsStateWithLifecycle()
    val items by farm.items.collectAsStateWithLifecycle()
    val reviewAdded by farm.reviewAdded.collectAsStateWithLifecycle()
    val syncing = online && items.orEmpty().any { !it.synced }
    val open = { id: String -> nav.navigate("record/$id") }
    Scaffold(
        containerColor = LocalMunda.current.mist,
        bottomBar = {
            if (TABS.any { it.route == current }) NavigationBar(containerColor = LocalMunda.current.card) {
                TABS.forEach { t ->
                    NavigationBarItem(
                        selected = current == t.route, onClick = { nav.navigate(t.route) { popUpTo("home") { saveState = true }; launchSingleTop = true; restoreState = true } },
                        icon = { Icon(t.icon, null) }, label = { Text(s.t(t.key)) },
                        colors = NavigationBarItemDefaults.colors(selectedIconColor = LocalMunda.current.forest, selectedTextColor = LocalMunda.current.forest, indicatorColor = LocalMunda.current.sprout),
                    )
                }
            }
        },
    ) { pad ->
        Column(Modifier.padding(bottom = pad.calculateBottomPadding())) {
            ConnectionBanner(online, syncing, reviewAdded, open)
            NavHost(nav, startDestination = "home") {
                composable("home") { HomeScreen(farm, onCheck = { nav.navigate("observe") }, onOpen = open, onPlot = { nav.navigate("plot/$it") }, onPlots = { nav.navigate("plots") }, onGuide = { nav.navigate("guide") }) }
                composable("plots") { PlotsScreen(farm) { nav.navigate("plot/$it") } }
                composable("plot/{key}") { e -> PlotScreen(farm, e.arguments?.getString("key").orEmpty(), { nav.popBackStack() }, open) }
                composable("guide") { GuideScreen(farm) { nav.navigate("guide/$it") } }
                composable("guide/{id}") { e -> GuideEntryScreen(farm, e.arguments?.getString("id").orEmpty()) { nav.popBackStack() } }
                composable("me") { MeScreen(farm) }
                composable("observe") {
                    ObserveScreen(viewModel { ObserveViewModel(app.container, app) }, farm, onDone = { nav.popBackStack() },
                        onSaved = { id -> nav.navigate("record/$id") { popUpTo("observe") { inclusive = true } } })
                }
                composable("record/{id}") { e -> RecordScreen(farm, e.arguments?.getString("id").orEmpty(), { nav.popBackStack() }) { nav.navigate("plot/$it") } }
            }
        }
    }
}

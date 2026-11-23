package app.munda

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import app.munda.ui.MundaTheme
import app.munda.ui.ObservationDetailScreen
import app.munda.ui.ObservationDetailViewModel
import app.munda.ui.ObservationsScreen
import app.munda.ui.ObservationsViewModel
import app.munda.ui.ObserveScreen
import app.munda.ui.ObserveViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as MundaApp
        setContent {
            MundaTheme {
                val nav = rememberNavController()
                NavHost(navController = nav, startDestination = "observations") {
                    composable("observations") {
                        ObservationsScreen(
                            vm = viewModel { ObservationsViewModel(app.container) },
                            onNew = { nav.navigate("observe") },
                            onOpen = { id -> nav.navigate("observation/$id") },
                        )
                    }
                    composable("observe") {
                        ObserveScreen(
                            vm = viewModel { ObserveViewModel(app.container, app) },
                            onDone = { nav.popBackStack() },
                            // Open the saved record in place of the flow, so Back returns to the list.
                            onSaved = { id -> nav.navigate("observation/$id") { popUpTo("observe") { inclusive = true } } },
                        )
                    }
                    composable("observation/{id}") { entry ->
                        val id = entry.arguments?.getString("id").orEmpty()
                        ObservationDetailScreen(vm = viewModel { ObservationDetailViewModel(app.container, id) }, onBack = { nav.popBackStack() })
                    }
                }
            }
        }
    }
}

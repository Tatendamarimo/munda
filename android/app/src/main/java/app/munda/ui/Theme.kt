package app.munda.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.munda.R
import app.munda.domain.Likelihood
import app.munda.domain.Urgency

/**
 * Munda's visual system: design B, the same tokens as web/src/ui/styles.css. Deep forest green
 * hero, maize gold for the main action and the kernel meter, paper background, rust for getting
 * worse, rain blue for cloud and weather. Light only: read outdoors in the sun. Older names
 * (mist, leafWash, kernel, sky…) are kept as aliases so existing components keep working.
 */
@Immutable
data class MundaColors(
    val forest: Color, val leaf2: Color, val sprout: Color, val maize: Color, val maizeDeep: Color, val husk: Color,
    val rust: Color, val rustWash: Color, val card: Color,
    val mist: Color, val paper: Color,
    val leaf: Color, val leafStrong: Color, val leafSoft: Color, val leafWash: Color,
    val ink: Color, val ink2: Color, val rule: Color, val ruleStrong: Color,
    val kernel: Color, val kernelDeep: Color, val kernelEmpty: Color,
    val sky: Color, val skyWash: Color, val soil: Color, val soilWash: Color,
    val alert: Color, val alertWash: Color, val amber: Color, val amberWash: Color,
    val onLeaf: Color,
) {
    fun likelihood(l: Likelihood) = when (l) { Likelihood.HIGH -> kernelDeep; Likelihood.MEDIUM -> ink; Likelihood.LOW -> ink2 }
    fun urgency(u: Urgency): Pair<Color, Color> = when (u) {
        Urgency.ROUTINE -> leaf to leafWash
        Urgency.SOON -> amber to amberWash
        Urgency.URGENT -> alert to alertWash
    }
}

private val Light = MundaColors(
    forest = Color(0xFF0C3B24), leaf2 = Color(0xFF1F7A4A), sprout = Color(0xFFCFE9D6),
    maize = Color(0xFFF2B705), maizeDeep = Color(0xFFB98900), husk = Color(0xFFFFF4D1),
    rust = Color(0xFFC2410C), rustWash = Color(0xFFFDE8DC), card = Color(0xFFFFFFFF),
    mist = Color(0xFFF7F5EE), paper = Color(0xFFFFFFFF),
    leaf = Color(0xFF14633A), leafStrong = Color(0xFF0C3B24), leafSoft = Color(0xFFCFE9D6), leafWash = Color(0xFFEAF3EC),
    ink = Color(0xFF12201A), ink2 = Color(0xFF4B5A51), rule = Color(0xFFE3E1D6), ruleStrong = Color(0xFFC9CDC0),
    kernel = Color(0xFFF2B705), kernelDeep = Color(0xFFB98900), kernelEmpty = Color(0xFFE6E3D6),
    sky = Color(0xFF2D6A9A), skyWash = Color(0xFFE2EDF6), soil = Color(0xFF7A5530), soilWash = Color(0xFFF0E7DC),
    alert = Color(0xFFB42318), alertWash = Color(0xFFFBE6E3), amber = Color(0xFF8A5A00), amberWash = Color(0xFFFFF4D1),
    onLeaf = Color.White,
)

val LocalMunda = staticCompositionLocalOf { Light }

val Display = FontFamily(Font(R.font.bricolage_bold, FontWeight.Bold))
val Body = FontFamily(Font(R.font.atkinson_regular, FontWeight.Normal), Font(R.font.atkinson_bold, FontWeight.Bold))

private fun typography(c: MundaColors) = Typography(
    headlineLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 34.sp, lineHeight = 36.sp, letterSpacing = (-0.03).em, color = c.ink),
    headlineMedium = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 32.sp, letterSpacing = (-0.01).em),
    titleLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 21.sp, lineHeight = 27.sp),
    titleMedium = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 23.sp),
    titleSmall = TextStyle(fontFamily = Body, fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontFamily = Body, fontSize = 17.sp, lineHeight = 26.sp),
    bodyMedium = TextStyle(fontFamily = Body, fontSize = 15.sp, lineHeight = 22.sp),
    bodySmall = TextStyle(fontFamily = Body, fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight.Bold, fontSize = 15.sp),
    labelMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight.Bold, fontSize = 13.sp),
    labelSmall = TextStyle(fontFamily = Body, fontSize = 12.sp),
)

/** Fixed light palette (no dynamic colour, no dark mode) so status colours stay legible outdoors. */
@Composable
fun MundaTheme(content: @Composable () -> Unit) {
    val c = Light
    val scheme = lightColorScheme().copy(
        primary = c.leaf, onPrimary = c.onLeaf, background = c.mist, onBackground = c.ink,
        surface = c.paper, onSurface = c.ink, surfaceVariant = c.leafWash, onSurfaceVariant = c.ink2,
        outline = c.ruleStrong, outlineVariant = c.rule, error = c.alert, secondary = c.kernelDeep, tertiary = c.sky,
        surfaceContainer = c.paper, surfaceContainerLow = c.paper, surfaceContainerHigh = c.paper,
    )
    CompositionLocalProvider(LocalMunda provides c) {
        MaterialTheme(colorScheme = scheme, typography = typography(c), content = content)
    }
}

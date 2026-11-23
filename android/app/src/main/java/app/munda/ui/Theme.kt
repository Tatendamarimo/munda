package app.munda.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
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
 * Munda's visual system, shared with the web client ("the scouting sheet"): mist, leaf, ink,
 * kernel (sparingly), sky for cloud, soil for on-device storage. Bricolage Grotesque for
 * headings, Atkinson Hyperlegible Next for reading (legible outdoors and for varied literacy).
 */
@Immutable
data class MundaColors(
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
    mist = Color(0xFFF1F3EE), paper = Color(0xFFFFFFFF),
    leaf = Color(0xFF1F5135), leafStrong = Color(0xFF163D28), leafSoft = Color(0xFF9CCF9F), leafWash = Color(0xFFE3ECE2),
    ink = Color(0xFF16241B), ink2 = Color(0xFF445149), rule = Color(0xFFD5DBD1), ruleStrong = Color(0xFFB8C1B4),
    kernel = Color(0xFFF2B705), kernelDeep = Color(0xFFB98900), kernelEmpty = Color(0xFFDFE3D9),
    sky = Color(0xFF2D5F8A), skyWash = Color(0xFFE1EAF2), soil = Color(0xFF7A5530), soilWash = Color(0xFFF0E7DC),
    alert = Color(0xFFB42318), alertWash = Color(0xFFFBE6E3), amber = Color(0xFF8A5A00), amberWash = Color(0xFFF7ECD2),
    onLeaf = Color.White,
)

private val Dark = MundaColors(
    mist = Color(0xFF101712), paper = Color(0xFF172019),
    leaf = Color(0xFF8FD19A), leafStrong = Color(0xFFB4E3B9), leafSoft = Color(0xFF4F8A5A), leafWash = Color(0xFF1D2E22),
    ink = Color(0xFFE6ECE4), ink2 = Color(0xFFA9B5AB), rule = Color(0xFF2B372E), ruleStrong = Color(0xFF3D4B40),
    kernel = Color(0xFFF5C533), kernelDeep = Color(0xFFF5C533), kernelEmpty = Color(0xFF2C3A2F),
    sky = Color(0xFF93C1EA), skyWash = Color(0xFF1A2A37), soil = Color(0xFFE0B385), soilWash = Color(0xFF2E251B),
    alert = Color(0xFFFF8F84), alertWash = Color(0xFF3A1D1A), amber = Color(0xFFF0C060), amberWash = Color(0xFF33291A),
    onLeaf = Color(0xFF0C1F12),
)

val LocalMunda = staticCompositionLocalOf { Light }

val Display = FontFamily(Font(R.font.bricolage_bold, FontWeight.Bold))
val Body = FontFamily(Font(R.font.atkinson_regular, FontWeight.Normal), Font(R.font.atkinson_bold, FontWeight.Bold))

private fun typography(c: MundaColors) = Typography(
    headlineLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 34.sp, lineHeight = 36.sp, letterSpacing = (-0.03).em, color = c.leaf),
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

/** Fixed palette (no dynamic colour) so status colours stay legible outdoors in sunlight. */
@Composable
fun MundaTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val c = if (dark) Dark else Light
    val scheme = (if (dark) darkColorScheme() else lightColorScheme()).copy(
        primary = c.leaf, onPrimary = c.onLeaf, background = c.mist, onBackground = c.ink,
        surface = c.paper, onSurface = c.ink, surfaceVariant = c.leafWash, onSurfaceVariant = c.ink2,
        outline = c.ruleStrong, outlineVariant = c.rule, error = c.alert, secondary = c.kernelDeep, tertiary = c.sky,
        surfaceContainer = c.paper, surfaceContainerLow = c.paper, surfaceContainerHigh = c.paper,
    )
    CompositionLocalProvider(LocalMunda provides c) {
        MaterialTheme(colorScheme = scheme, typography = typography(c), content = content)
    }
}

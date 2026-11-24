package app.munda.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.unit.dp
import app.munda.domain.AffectedArea
import app.munda.domain.CropStage
import app.munda.domain.Onset
import app.munda.domain.Rainfall
import kotlin.math.cos
import kotlin.math.sin

/**
 * Small drawings for each answer, so a farmer who reads little can still answer by looking.
 * A port of web/src/ui/observe/pictures.tsx: the same 160×60 drawings and colours.
 */
private val SOIL = Color(0xFFCDBB94)
private val LEAF = Color(0xFF3F7A2F)
private val SICK = Color(0xFFE2B92E)
private val SKY = Color(0xFFDCEBF5)
private val RAIN = Color(0xFF2D6A9A)
private val GREY = Color(0xFF8A948C)

@Composable
private fun Frame(bg: Color, draw: DrawScope.() -> Unit) {
    Canvas(Modifier.fillMaxWidth().aspectRatio(160f / 60f).clip(RoundedCornerShape(12.dp))) {
        drawRect(bg)
        scale(size.width / 160f, size.height / 60f, pivot = Offset.Zero) { draw() }
    }
}

private fun DrawScope.plants(sick: (Int, Int) -> Boolean, y: Float = 14f, h: Float = 34f) {
    for (row in 0 until 2) for (i in 0 until 9) {
        drawRoundRect(if (sick(i, row)) SICK else LEAF, Offset(10f + i * 16 + row * 8, y + row * 6), Size(7f, h - row * 10), CornerRadius(3f))
    }
}

@Composable
private fun Unknown() = Frame(Color(0xFFECE9DF)) {
    drawCircle(GREY, 18f, Offset(80f, 30f), style = Stroke(4f))
    val p = Path().apply { moveTo(73f, 25f); cubicTo(73f, 16f, 87f, 16f, 87f, 25f); cubicTo(87f, 29f, 80f, 30f, 80f, 36f) }
    drawPath(p, GREY, style = Stroke(4f, cap = StrokeCap.Round))
    drawCircle(GREY, 2.5f, Offset(80f, 42f))
}

@Composable
fun AreaPicture(a: AffectedArea) = when (a) {
    AffectedArea.FEW_PLANTS -> Frame(SOIL) { plants({ i, _ -> i == 2 || i == 6 }) }
    AffectedArea.PATCHES -> Frame(SOIL) { plants({ i, _ -> i <= 2 || i in 6..7 }) }
    AffectedArea.LOW_SPOTS -> Frame(SOIL) {
        drawPath(Path().apply { moveTo(0f, 44f); quadraticTo(80f, 62f, 160f, 44f); lineTo(160f, 60f); lineTo(0f, 60f); close() }, Color(0xFF8FB3CF))
        plants({ i, _ -> i in 3..6 })
    }
    AffectedArea.FIELD_EDGES -> Frame(SOIL) { plants({ i, _ -> i == 0 || i == 8 }) }
    AffectedArea.MOST_OF_FIELD -> Frame(SOIL) { plants({ i, _ -> i != 4 }) }
    AffectedArea.UNKNOWN -> Unknown()
}

private fun DrawScope.cloud(dark: Boolean) {
    val x = 80f
    val p = Path().apply {
        moveTo(x - 26, 26f); cubicTo(x - 26, 18f, x - 21, 13f, x - 16, 12f)
        cubicTo(x - 12, 2f, x + 8, 2f, x + 12, 14f); cubicTo(x + 20, 12f, x + 28, 18f, x + 26, 26f); close()
    }
    drawPath(p, if (dark) Color(0xFF7C8F9E) else Color.White)
}

private fun DrawScope.drops(n: Int) {
    for (i in 0 until n) drawLine(RAIN, Offset(58f + i * 9, 34f + (i % 2) * 5), Offset(55f + i * 9, 44f + (i % 2) * 5), 3f, StrokeCap.Round)
}

@Composable
fun RainPicture(r: Rainfall) = when (r) {
    Rainfall.NONE -> Frame(Color(0xFFFDF1C7)) {
        val sun = Color(0xFFF2B705)
        drawCircle(sun, 13f, Offset(80f, 30f))
        for (i in 0 until 8) {
            val a = i * Math.PI / 4
            drawLine(sun, Offset(80f + cos(a).toFloat() * 18, 30f + sin(a).toFloat() * 18), Offset(80f + cos(a).toFloat() * 25, 30f + sin(a).toFloat() * 25), 3f, StrokeCap.Round)
        }
    }
    Rainfall.LIGHT -> Frame(SKY) { cloud(false); drops(2) }
    Rainfall.HEAVY -> Frame(Color(0xFFC9DBE8)) { cloud(true); drops(5) }
    Rainfall.FLOODING -> Frame(Color(0xFFC9DBE8)) {
        cloud(true); drops(4)
        val w = Path().apply {
            moveTo(0f, 46f)
            for (k in 0 until 8) { relativeQuadraticTo(10f, -5f, 20f, 0f) }
            lineTo(160f, 60f); lineTo(0f, 60f); close()
        }
        drawPath(w, RAIN.copy(alpha = .75f))
    }
    Rainfall.UNKNOWN -> Unknown()
}

/** A two-week strip: the highlighted days are when it started. */
@Composable
private fun Days(from: Int, to: Int, faded: Boolean = false) = Frame(Color(0xFFF4F1E6)) {
    for (i in 0 until 14) {
        val on = i in from..to
        drawRoundRect(if (on) (if (faded) Color(0xFFC9A54A) else Color(0xFFF2B705)) else Color(0xFFDDD8C6), Offset(8f + i * 10.4f, 20f), Size(8f, 20f), CornerRadius(2f))
    }
    drawRoundRect(Color(0xFF14633A), Offset(8f + 13 * 10.4f - 1, 17f), Size(10f, 26f), CornerRadius(3f), style = Stroke(2f))
}

@Composable
fun OnsetPicture(o: Onset) = when (o) {
    Onset.RECENT -> Days(12, 13)
    Onset.THIS_WEEK -> Days(7, 13)
    Onset.ONE_TO_TWO_WEEKS -> Days(0, 7)
    Onset.LONGER -> Days(0, 2, faded = true)
    Onset.UNKNOWN -> Unknown()
}

/** Maize at each stage: height, then tassel, then cob. */
@Composable
private fun Maize(h: Float, tassel: Boolean = false, cob: Boolean = false, dry: Boolean = false) = Frame(Color(0xFFF1ECDC)) {
    val c = if (dry) Color(0xFFB99B55) else LEAF
    val top = 56f - h
    drawRect(SOIL, Offset(0f, 54f), Size(160f, 6f))
    drawRect(c, Offset(78f, top), Size(4f, h))
    if (h > 10) {
        val leaves = Path().apply {
            moveTo(80f, top + h * .55f); relativeQuadraticTo(-22f, -4f, -30f, -14f); relativeQuadraticTo(16f, 2f, 30f, 8f); close()
            moveTo(80f, top + h * .35f); relativeQuadraticTo(22f, -4f, 30f, -14f); relativeQuadraticTo(-16f, 2f, -30f, 8f); close()
        }
        drawPath(leaves, c)
    }
    if (tassel) {
        val t = Color(0xFFC9A54A)
        drawLine(t, Offset(80f, top), Offset(74f, top - 6), 2.5f, StrokeCap.Round)
        drawLine(t, Offset(80f, top), Offset(80f, top - 8), 2.5f, StrokeCap.Round)
        drawLine(t, Offset(80f, top), Offset(86f, top - 6), 2.5f, StrokeCap.Round)
    }
    if (cob) drawOval(if (dry) Color(0xFFD9B45A) else Color(0xFFF2D36B), Offset(84f, top + h * .5f - 9), Size(8f, 18f))
}

@Composable
fun StagePicture(s: CropStage) = when (s) {
    CropStage.EMERGENCE -> Maize(8f)
    CropStage.EARLY_GROWTH -> Maize(20f)
    CropStage.LATE_GROWTH -> Maize(36f)
    CropStage.TASSELING -> Maize(42f, tassel = true)
    CropStage.GRAIN_FILL -> Maize(42f, tassel = true, cob = true)
    CropStage.MATURITY -> Maize(42f, cob = true, dry = true)
    CropStage.UNKNOWN -> Unknown()
}

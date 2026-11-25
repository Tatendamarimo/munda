package app.munda.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * What each guide problem looks like, from shared/guides/images (the same files as the web app):
 * a credited photo, or a drawing marked as one. Read from assets, so it works offline.
 */
@Serializable
data class GuideImageCredit(val kind: String, val file: String, val author: String? = null, val license: String? = null, val source: String? = null)

private object GuideImages {
    private val json = Json { ignoreUnknownKeys = true }
    private var credits: Map<String, GuideImageCredit>? = null
    private val bitmaps = HashMap<String, ImageBitmap?>()

    fun credit(context: android.content.Context, id: String): GuideImageCredit? {
        val all = credits ?: runCatching {
            json.decodeFromString<Map<String, GuideImageCredit>>(context.assets.open("guides/images/maize.json").bufferedReader().use { it.readText() })
        }.getOrDefault(emptyMap()).also { credits = it }
        return all[id]
    }

    fun bitmap(context: android.content.Context, c: GuideImageCredit): ImageBitmap? = bitmaps.getOrPut(c.file) {
        runCatching { context.assets.open("guides/images/maize/${c.file}").use { BitmapFactory.decodeStream(it)?.asImageBitmap() } }.getOrNull()
    }
}

@Composable
fun GuidePicture(id: String?, alt: String, compact: Boolean = false) {
    id ?: return
    val context = LocalContext.current
    val c = remember(id) { GuideImages.credit(context, id) } ?: return
    val img = remember(c.file) { GuideImages.bitmap(context, c) } ?: return
    val s = strings()
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Image(img, alt, Modifier.fillMaxWidth().aspectRatio(if (compact) 16f / 9f else 3f / 2f).clip(RoundedCornerShape(if (compact) 14.dp else 20.dp)), contentScale = ContentScale.Fit)
        val caption = if (c.kind == "photo") s.t("guide.photoBy", "credit" to listOfNotNull(c.author, c.license).joinToString(" · ")) else s.t("guide.drawing")
        Text(caption, style = MaterialTheme.typography.labelSmall, color = LocalMunda.current.ink2)
    }
}

@Composable
fun GuideThumb(id: String) {
    val context = LocalContext.current
    val c = remember(id) { GuideImages.credit(context, id) } ?: return
    val img = remember(c.file) { GuideImages.bitmap(context, c) } ?: return
    Image(img, null, Modifier.size(52.dp).clip(RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
}

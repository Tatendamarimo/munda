package app.munda.ui

import android.graphics.BitmapFactory
import android.graphics.Bitmap
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
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
data class PhotoCrop(val x: Int, val y: Int, val width: Int, val height: Int, val sourceWidth: Int, val sourceHeight: Int)

@Serializable
data class GuideImageCredit(val kind: String, val file: String, val author: String? = null, val license: String? = null, val source: String? = null, val licenseUrl: String? = null, val crop: PhotoCrop? = null)

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

    fun bitmap(context: android.content.Context, c: GuideImageCredit): ImageBitmap? = bitmaps.getOrPut("${c.file}:${c.crop}") {
        runCatching {
            val bitmap = context.assets.open("guides/images/maize/${c.file}").use { BitmapFactory.decodeStream(it) } ?: return@runCatching null
            val crop = c.crop
            if (crop == null) bitmap.asImageBitmap() else {
                val left = (crop.x.toLong() * bitmap.width / crop.sourceWidth).toInt().coerceIn(0, bitmap.width - 1)
                val top = (crop.y.toLong() * bitmap.height / crop.sourceHeight).toInt().coerceIn(0, bitmap.height - 1)
                val width = (crop.width.toLong() * bitmap.width / crop.sourceWidth).toInt().coerceIn(1, bitmap.width - left)
                val height = (crop.height.toLong() * bitmap.height / crop.sourceHeight).toInt().coerceIn(1, bitmap.height - top)
                Bitmap.createBitmap(bitmap, left, top, width, height).asImageBitmap()
            }
        }.getOrNull()
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
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (!compact) c.source?.let { url -> Text(s.t("guide.source"), Modifier.clickable { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }, style = MaterialTheme.typography.labelSmall, color = LocalMunda.current.leaf) }
            c.licenseUrl?.let { url -> Text(s.t("guide.license"), Modifier.clickable { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }, style = MaterialTheme.typography.labelSmall, color = LocalMunda.current.leaf) }
        }
    }
}

@Composable
fun GuideThumb(id: String) {
    val context = LocalContext.current
    val c = remember(id) { GuideImages.credit(context, id) } ?: return
    val img = remember(c.file) { GuideImages.bitmap(context, c) } ?: return
    Image(img, null, Modifier.size(52.dp).clip(RoundedCornerShape(12.dp)), contentScale = ContentScale.Crop)
}

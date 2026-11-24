package app.munda.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.File

/**
 * Photos of checks saved before they could be finished (offline, no on-device AI). Kept in the
 * app's private storage only, never synced; used once when signal returns, then deleted.
 * Mirrors web/src/data/pendingPhotos.ts.
 */
class PendingPhotos(context: Context) {
    private val dir = File(context.filesDir, "pending-photos").apply { mkdirs() }
    private fun file(id: String) = File(dir, "${id.filter { it.isLetterOrDigit() || it == '-' || it == '_' }}.jpg")

    fun put(id: String, photo: Bitmap) = runCatching { file(id).outputStream().use { photo.compress(Bitmap.CompressFormat.JPEG, 80, it) } }.isSuccess
    fun get(id: String): Bitmap? = file(id).takeIf { it.exists() }?.let { runCatching { BitmapFactory.decodeFile(it.path) }.getOrNull() }
    fun delete(id: String) { file(id).delete() }
}

package app.munda.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Loads a picked image as a Bitmap no larger than [maxSide] px on its long edge. Dataset photos
 * are often 4000+ px; the model doesn't benefit from that and decoding it full-size risks OOM.
 */
suspend fun loadScaledBitmap(context: Context, uri: Uri, maxSide: Int = 1024): Bitmap? = withContext(Dispatchers.IO) {
    try {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return@withContext null

        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
        val decoded = context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: return@withContext null

        val longSide = maxOf(decoded.width, decoded.height)
        if (longSide <= maxSide) decoded
        else {
            val scale = maxSide.toFloat() / longSide
            Bitmap.createScaledBitmap(decoded, (decoded.width * scale).toInt(), (decoded.height * scale).toInt(), true)
                .also { if (it !== decoded) decoded.recycle() }
        }
    } catch (e: Exception) {
        Log.w("ImageLoading", "Couldn't load picked image", e)
        null
    }
}

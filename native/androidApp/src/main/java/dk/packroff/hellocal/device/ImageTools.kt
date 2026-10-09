package dk.packroff.hellocal.device

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Decoding, EXIF rotation, scaling and JPEG encoding — the canvas work the web does in the browser. */
internal object ImageTools {
    /** Any image → JPEG that fits [maxWidth]×[maxHeight] (never up-scaled), EXIF orientation applied. */
    fun scaleJpeg(bytes: ByteArray, maxWidth: Int, maxHeight: Int, quality: Double): ByteArray? {
        val bitmap = decode(bytes, maxWidth, maxHeight) ?: return null
        return try {
            jpeg(bitmap, quality)
        } finally {
            bitmap.recycle()
        }
    }

    /** Decodes with EXIF rotation and scales to fit [maxWidth]×[maxHeight]. */
    fun decode(bytes: ByteArray, maxWidth: Int, maxHeight: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        val rotation = exifRotation(bytes)
        val turned = rotation == 90 || rotation == 270
        val width = if (turned) bounds.outHeight else bounds.outWidth
        val height = if (turned) bounds.outWidth else bounds.outHeight
        val scale = scaleFor(width, height, maxWidth, maxHeight)
        val targetWidth = max(1, (width * scale).roundToInt())
        val targetHeight = max(1, (height * scale).roundToInt())

        // Decode at the smallest power-of-two size that is still >= the target.
        var sample = 1
        while (width / (sample * 2) >= targetWidth && height / (sample * 2) >= targetHeight) sample *= 2
        val raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: return null
        val rotated = if (rotation != 0) {
            Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, Matrix().apply { postRotate(rotation.toFloat()) }, true)
                .also { if (it !== raw) raw.recycle() }
        } else {
            raw
        }
        return resize(rotated, targetWidth, targetHeight)
    }

    /** Scales a bitmap to fit [maxWidth]×[maxHeight] (never up). Recycles [source] when a new bitmap is made. */
    fun fit(source: Bitmap, maxWidth: Int, maxHeight: Int): Bitmap {
        val scale = scaleFor(source.width, source.height, maxWidth, maxHeight)
        return resize(source, max(1, (source.width * scale).roundToInt()), max(1, (source.height * scale).roundToInt()))
    }

    fun jpeg(bitmap: Bitmap, quality: Double): ByteArray {
        // JPEG has no transparency: draw on white like a canvas export would show it.
        val opaque = if (bitmap.hasAlpha()) {
            Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888).also { out ->
                Canvas(out).apply {
                    drawColor(Color.WHITE)
                    drawBitmap(bitmap, 0f, 0f, null)
                }
            }
        } else {
            bitmap
        }
        val stream = ByteArrayOutputStream()
        opaque.compress(Bitmap.CompressFormat.JPEG, (quality * 100).roundToInt().coerceIn(1, 100), stream)
        if (opaque !== bitmap) opaque.recycle()
        return stream.toByteArray()
    }

    /** 16×16 grey fingerprint, (r+g+b)/3 per pixel — src/lib/video-frames.ts fingerprint(). */
    fun grey16(bitmap: Bitmap): ByteArray {
        val small = Bitmap.createScaledBitmap(bitmap, 16, 16, true)
        val pixels = IntArray(256)
        small.getPixels(pixels, 0, 16, 0, 0, 16, 16)
        if (small !== bitmap) small.recycle()
        return ByteArray(256) { i ->
            val p = pixels[i]
            ((Color.red(p) + Color.green(p) + Color.blue(p)) / 3).toByte()
        }
    }

    private fun scaleFor(width: Int, height: Int, maxWidth: Int, maxHeight: Int): Double =
        min(1.0, min(maxWidth.toDouble() / width, maxHeight.toDouble() / height))

    private fun resize(source: Bitmap, width: Int, height: Int): Bitmap {
        if (source.width == width && source.height == height) return source
        return Bitmap.createScaledBitmap(source, width, height, true).also { if (it !== source) source.recycle() }
    }

    private fun exifRotation(bytes: ByteArray): Int =
        runCatching { ExifInterface(ByteArrayInputStream(bytes)).rotationDegrees }.getOrDefault(0)
}

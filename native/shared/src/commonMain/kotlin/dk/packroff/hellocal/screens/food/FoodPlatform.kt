package dk.packroff.hellocal.screens.food

import dk.packroff.hellocal.platform.Device
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

/** A photo from the camera or the gallery (JPEG, longest edge ≈ 1600 px like the web's downscale). */
class FoodPhoto(val bytes: ByteArray, val mime: String = "image/jpeg", val takenAtMillis: Long? = null) {
    /** "data:image/jpeg;base64,…" — the web sends photos to the API as data URLs. */
    @OptIn(ExperimentalEncodingApi::class)
    fun dataUrl(): String = "data:$mime;base64," + Base64.Default.encode(bytes)
}

/**
 * Device features the food screens need where the web uses <input type="file"
 * capture>, tesseract.js, ZXing and navigator.share. Every hook forwards to
 * the shared device layer (platform/Device.kt). Without a platform the hooks
 * are null and the screens show their normal "failed"/fallback states (no
 * crash): photo buttons do nothing, barcode/text reading falls back to typing
 * or the server's AI.
 */
object FoodPlatform {
    private val takePhotoCall: suspend (Boolean) -> FoodPhoto? = { fromGallery ->
        val bytes = if (fromGallery) Device.pickPhotos(1).firstOrNull() else Device.takePhoto()
        bytes?.let { FoodPhoto(it) }
    }
    private val pickPhotosCall: suspend (Int) -> List<FoodPhoto> = { max -> Device.pickPhotos(max).map { FoodPhoto(it) } }
    private val recognizeTextCall: suspend (FoodPhoto, String) -> Pair<String, Double>? = { photo, languages ->
        Device.recognizeText(photo.bytes, languages)?.let { it.text to it.confidence }
    }
    private val decodeBarcodeCall: suspend (FoodPhoto) -> String? = { photo -> Device.decodeBarcode(photo.bytes) }
    private val shareCall: (String, String, String) -> Boolean = { title, text, url -> Device.share(title, text, url) }

    /** Opens the camera (fromGallery = false) or the photo library; null when cancelled. */
    val takePhoto: (suspend (fromGallery: Boolean) -> FoodPhoto?)?
        get() = if (Device.available) takePhotoCall else null

    /** Picks up to max photos from the library (RecipeImagesPicker, ScanSheet "Galleri"). */
    val pickPhotos: (suspend (max: Int) -> List<FoodPhoto>)?
        get() = if (Device.available) pickPhotosCall else null

    /** Local OCR (web: tesseract.js) — returns the recognised text and its confidence 0..100. */
    val recognizeText: (suspend (photo: FoodPhoto, languages: String) -> Pair<String, Double>?)?
        get() = if (Device.available) recognizeTextCall else null

    /** Decodes a barcode in a photo (web: ZXing BrowserMultiFormatReader). */
    val decodeBarcode: (suspend (photo: FoodPhoto) -> String?)?
        get() = if (Device.available) decodeBarcodeCall else null

    /** System share sheet (web: navigator.share); false when unavailable. */
    val share: ((title: String, text: String, url: String) -> Boolean)?
        get() = if (Device.available) shareCall else null

    suspend fun photo(fromGallery: Boolean): FoodPhoto? = runCatching { takePhoto?.invoke(fromGallery) }.getOrNull()

    suspend fun photos(max: Int): List<FoodPhoto> {
        val picker = pickPhotos
        if (picker != null) return runCatching { picker(max) }.getOrDefault(emptyList())
        return listOfNotNull(photo(fromGallery = true))
    }
}

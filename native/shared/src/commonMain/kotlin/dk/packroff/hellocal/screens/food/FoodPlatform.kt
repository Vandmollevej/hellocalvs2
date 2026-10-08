package dk.packroff.hellocal.screens.food

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
 * capture>, tesseract.js, ZXing and navigator.share.
 *
 * TODO(parity): wire these in the Android app (HelloCalApplication) and the
 * iPhone app (iosApp) like NativeHooks — or move them into platform/ as
 * expect/actual. Until then the screens show their normal "failed"/fallback
 * states (no crash): photo buttons do nothing, barcode/text reading falls back
 * to typing or the server's AI.
 */
object FoodPlatform {
    /** Opens the camera (fromGallery = false) or the photo library; null when cancelled. */
    var takePhoto: (suspend (fromGallery: Boolean) -> FoodPhoto?)? = null

    /** Picks up to [max] photos from the library (RecipeImagesPicker, ScanSheet "Galleri"). */
    var pickPhotos: (suspend (max: Int) -> List<FoodPhoto>)? = null

    /** Local OCR (web: tesseract.js) — returns the recognised text and its confidence 0..100. */
    var recognizeText: (suspend (photo: FoodPhoto, languages: String) -> Pair<String, Double>?)? = null

    /** Decodes a barcode in a photo (web: ZXing BrowserMultiFormatReader). */
    var decodeBarcode: (suspend (photo: FoodPhoto) -> String?)? = null

    /** System share sheet (web: navigator.share); false when unavailable. */
    var share: ((title: String, text: String, url: String) -> Boolean)? = null

    suspend fun photo(fromGallery: Boolean): FoodPhoto? = runCatching { takePhoto?.invoke(fromGallery) }.getOrNull()

    suspend fun photos(max: Int): List<FoodPhoto> {
        val picker = pickPhotos
        if (picker != null) return runCatching { picker(max) }.getOrDefault(emptyList())
        return listOfNotNull(photo(fromGallery = true))
    }
}

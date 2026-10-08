package dk.packroff.hellocal.screens.capture

import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

/** Thrown by a platform hook when the user refused camera/microphone access. */
class CapturePermissionDenied : Exception("permission denied")

/**
 * Platform features the capture screens need (PORTING.md rule 7). The web uses
 * getUserMedia, BarcodeDetector and SpeechRecognition; natively the Android app
 * (HelloCalApplication) and the iPhone app (HelloCalApp.swift) fill these in at
 * start-up, the same way as NativeHooks. While a hook is null the screen shows
 * the web's "camera/microphone not available" text instead of silently hiding
 * the feature.
 *
 * TODO(platform): Android — takePhoto via ActivityResultContracts.TakePicture
 * (JPEG bytes), scanBarcode via ML Kit GmsBarcodeScanning, recordSpeech via
 * SpeechRecognizer (RecognizerIntent with the language tag). iPhone —
 * UIImagePickerController, VisionKit DataScannerViewController and
 * SFSpeechRecognizer.
 */
object CaptureHooks {
    /** Opens the camera; returns the photo as JPEG bytes, or null when the user cancelled. */
    var takePhoto: (suspend () -> ByteArray?)? = null

    /** Opens the barcode scanner; returns the EAN/UPC digits, or null when cancelled. */
    var scanBarcode: (suspend () -> String?)? = null

    /**
     * Listens once and returns the final transcript (null = nothing heard).
     * [languageTag] is a BCP-47 tag like "da-DK"; [onPartial] receives interim text.
     */
    var recordSpeech: (suspend (languageTag: String, onPartial: (String) -> Unit) -> String?)? = null

    /** Stops an ongoing [recordSpeech] early (the web's "stop" button). */
    var stopSpeech: () -> Unit = {}

    /**
     * The system share sheet (web: navigator.share) with a title and a text
     * (the text may be a URL). Null = "Deling understøttes ikke på denne enhed".
     * TODO(platform): Android Intent.ACTION_SEND chooser, iPhone UIActivityViewController.
     */
    var share: ((title: String, text: String) -> Unit)? = null
}

/** JPEG bytes → the data URL the web sends as `photo` to the AI routes. */
@OptIn(ExperimentalEncodingApi::class)
internal fun jpegDataUrl(bytes: ByteArray): String = "data:image/jpeg;base64," + Base64.encode(bytes)

@Serializable
internal data class MealShareTarget(val profileId: String, val factor: Double)

/**
 * src/lib/meal-share.ts — the profiles a new registration is also added to
 * (shared meal, docs/FAMILY.md). The web keeps it in sessionStorage
 * "hc_meal_share"; natively the same key lives in NativeHooks.secureStorage.
 */
internal object MealShare {
    private const val KEY = "hc_meal_share"

    fun read(): List<MealShareTarget> = NativeHooks.secureStorage.get(KEY)?.let {
        runCatching { ApiJson.decodeFromString(ListSerializer(MealShareTarget.serializer()), it) }.getOrNull()
    }.orEmpty()

    fun write(targets: List<MealShareTarget>) =
        NativeHooks.secureStorage.set(KEY, ApiJson.encodeToString(ListSerializer(MealShareTarget.serializer()), targets))

    /** mealShareBody(): { shareWith: [...] } when anything is chosen. */
    fun body(allowedProfileIds: List<String>? = null): Map<String, Any> {
        val targets = read().filter { allowedProfileIds == null || it.profileId in allowedProfileIds }
        return if (targets.isEmpty()) emptyMap()
        else mapOf("shareWith" to targets.map { mapOf("profileId" to it.profileId, "factor" to it.factor) })
    }
}

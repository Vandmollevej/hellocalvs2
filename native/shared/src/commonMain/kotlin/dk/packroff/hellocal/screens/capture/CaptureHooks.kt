package dk.packroff.hellocal.screens.capture

import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.platform.Device
import dk.packroff.hellocal.platform.DevicePermissionDenied
import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

/** Thrown when the user refused camera/microphone access (platform/Device.kt). */
typealias CapturePermissionDenied = DevicePermissionDenied

/**
 * Platform features the capture screens need (PORTING.md rule 7). The web uses
 * getUserMedia, BarcodeDetector and SpeechRecognition; natively every hook
 * forwards to the shared device layer (platform/Device.kt), which the Android
 * app and the iPhone app fill in at start-up. While no platform is set a hook
 * is null and the screen shows the web's "camera/microphone not available"
 * text instead of silently hiding the feature.
 */
object CaptureHooks {
    private val takePhotoCall: suspend () -> ByteArray? = { Device.takePhoto() }
    private val scanBarcodeCall: suspend () -> String? = { Device.scanBarcode() }
    private val recordSpeechCall: suspend (String, (String) -> Unit) -> String? =
        { languageTag, onPartial -> Device.recognizeSpeech(languageTag, onPartial) }
    private val shareCall: (String, String) -> Unit = { title, text -> Device.share(title, text) }

    /** Opens the camera; returns the photo as JPEG bytes, or null when the user cancelled. */
    val takePhoto: (suspend () -> ByteArray?)?
        get() = if (Device.available) takePhotoCall else null

    /** Opens the barcode scanner; returns the EAN/UPC digits, or null when cancelled. */
    val scanBarcode: (suspend () -> String?)?
        get() = if (Device.available) scanBarcodeCall else null

    /**
     * Listens once and returns the final transcript (null = nothing heard).
     * The first argument is a BCP-47 tag like "da-DK"; the callback receives interim text.
     */
    val recordSpeech: (suspend (languageTag: String, onPartial: (String) -> Unit) -> String?)?
        get() = if (Device.available) recordSpeechCall else null

    /** Stops an ongoing [recordSpeech] early (the web's "stop" button). */
    fun stopSpeech() = Device.stopSpeech()

    /**
     * The system share sheet (web: navigator.share) with a title and a text
     * (the text may be a URL). Null = "Deling understøttes ikke på denne enhed".
     */
    val share: ((title: String, text: String) -> Unit)?
        get() = if (Device.available) shareCall else null
}

/** JPEG bytes → the data URL the web sends as `photo` to the AI routes. */
internal fun jpegDataUrl(bytes: ByteArray): String = Device.jpegDataUrl(bytes)

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

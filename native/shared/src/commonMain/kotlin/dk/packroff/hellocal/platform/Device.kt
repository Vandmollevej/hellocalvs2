package dk.packroff.hellocal.platform

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import dk.packroff.hellocal.api.HelloCalConfig
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.math.abs

/*
 * The phone's own features (camera, photo library, scanner, OCR, speech,
 * share sheet, Face ID/fingerprint) in ONE place. The Android app
 * (androidApp/.../device/AndroidDevice.kt) and the iPhone app
 * (iosApp/HelloCal/IosDevice.swift) implement [DevicePlatform] and set
 * [Device.platform] at start-up. Screens never call the platform directly:
 * they use the suspend functions on [Device] (or the small per-area facades
 * CaptureHooks, FoodPlatform, OnboardingHooks, ProfileNativeBridge,
 * SettingsImportMedia and SettingsSupportHooks, which forward here).
 *
 * The platform API is callback based on purpose: Swift implements it as a
 * plain protocol (no Kotlin coroutines on the Swift side). Rules for
 * implementations:
 *  - every callback is called exactly once, on the main thread;
 *  - `error` is null on success or cancel, [DeviceError.DENIED] when the user
 *    refused the permission, [DeviceError.UNAVAILABLE] when the device has no
 *    such feature, [DeviceError.PARTIAL] when some of several items failed,
 *    any other text for other failures;
 *  - a cancelled picker/scanner reports (null, null).
 */

/** A file from the photo library (image or video), as picked — not re-encoded. */
class PickedFile(val mime: String, val bytes: ByteArray)

/** Text read on the phone (OCR) with its confidence 0..100 (like tesseract.js on the web). */
class RecognizedText(val text: String, val confidence: Double)

/**
 * One still from a video: the JPEG and a 16×16 grey "fingerprint" (256 bytes,
 * (r+g+b)/3 per pixel, row by row) used to skip near-identical frames —
 * src/lib/video-frames.ts.
 */
class VideoFrame(val jpeg: ByteArray, val grey16: ByteArray)

/** The user refused camera/microphone/photo access. */
open class DevicePermissionDenied : Exception("permission denied")

/** The phone cannot do this (no camera, no platform, …) or it failed. */
class DeviceUnavailable(message: String = DeviceError.UNAVAILABLE) : Exception(message)

object DeviceError {
    const val DENIED = "denied"
    const val UNAVAILABLE = "unavailable"
    const val PARTIAL = "partial"
    const val UNSUPPORTED = "unsupported"
}

interface DevicePlatform {
    /** Camera → JPEG, longest edge at most [maxEdge] px, EXIF orientation applied. */
    fun takePhoto(maxEdge: Int, quality: Double, onResult: (photo: ByteArray?, error: String?) -> Unit)

    /** System photo picker, up to [max] images → JPEGs like [takePhoto] (EXIF/GPS stripped by re-encoding). */
    fun pickPhotos(max: Int, maxEdge: Int, quality: Double, onResult: (photos: List<ByteArray>, error: String?) -> Unit)

    /** System picker for images AND videos (several), returned as picked. null = cancelled. */
    fun pickFiles(onResult: (files: List<PickedFile>?, error: String?) -> Unit)

    /** Any image (JPEG/PNG/HEIC) → JPEG scaled to fit [maxWidth]×[maxHeight] (never up-scaled). null = unreadable. */
    fun scaleImage(image: ByteArray, maxWidth: Int, maxHeight: Int, quality: Double, onResult: (jpeg: ByteArray?) -> Unit)

    /**
     * Stills from a video: first at 0.2 s, then every [stepSeconds] (the last
     * one clamped to the end), each scaled to at most [maxWidth] px wide. All
     * frames are returned; near-duplicates are removed in common code.
     */
    fun videoFrames(
        video: ByteArray,
        mime: String,
        stepSeconds: Double,
        maxWidth: Int,
        quality: Double,
        onResult: (frames: List<VideoFrame>, error: String?) -> Unit,
    )

    /** On-device OCR. [languages] are BCP-47 tags in order of preference ("da-DK", "en-US"). */
    fun recognizeText(image: ByteArray, languages: List<String>, onResult: (text: RecognizedText?) -> Unit)

    /** Live camera scanner for product barcodes (EAN-13/EAN-8/UPC). Returns the digits. */
    fun scanBarcode(onResult: (code: String?, error: String?) -> Unit)

    /** Finds a product barcode in a still photo. */
    fun decodeBarcode(image: ByteArray, onResult: (code: String?) -> Unit)

    /** Live camera scanner for QR codes. Returns the QR text. */
    fun scanQrCode(onResult: (text: String?, error: String?) -> Unit)

    /**
     * Listens once (stops by itself after a pause, or on [stopSpeech]).
     * [onPartial] gets interim text; [onFinished] the final transcript (null =
     * nothing heard). Starting again aborts a running session silently.
     */
    fun startSpeech(languageTag: String, onPartial: (text: String) -> Unit, onFinished: (transcript: String?, error: String?) -> Unit)

    /** Stops listening early; the final transcript then arrives in onFinished. */
    fun stopSpeech()

    /** System share sheet. False when it cannot be shown. */
    fun share(title: String, text: String, url: String?): Boolean

    /** Can the owner be confirmed here (Face ID/Touch ID/fingerprint or device code)? */
    fun canConfirmOwner(): Boolean

    /** Asks for Face ID/Touch ID/fingerprint or the device code. */
    fun confirmOnDevice(reason: String, onResult: (ok: Boolean) -> Unit)

    /** Passkey login (web: isPasskeySupported). TODO(platform): needs associated domains / asset links. */
    fun passkeySupported(): Boolean

    /** This device already has a passkey for the account (web: hasPasskeyOnDevice). */
    fun hasPasskeyOnDevice(): Boolean

    /** Creates a passkey via /api/auth/passkey/register/{options,verify}. error null = ok. */
    fun registerPasskey(onResult: (error: String?) -> Unit)

    /** Push for login approval: "ok" | "unsupported" | "denied" | "not-configured" | "failed". */
    fun enablePush(onResult: (status: String) -> Unit)
}

object Device {
    /** Set by the Android app (HelloCalApplication) and the iPhone app (HelloCalApp.swift). */
    var platform: DevicePlatform? = null

    val available: Boolean get() = platform != null

    /** Web: fileToDownscaledDataUrl(file, 1600, 0.85). */
    const val PHOTO_MAX_EDGE = 1600
    const val PHOTO_QUALITY = 0.85

    /** src/lib/video-frames.ts */
    const val FRAME_MAX_WIDTH = 900
    const val FRAME_STEP_SECONDS = 1.2
    const val FRAME_VIDEO_QUALITY = 0.75
    const val FRAME_IMAGE_QUALITY = 0.8
    private const val SAME_FRAME_DIFF = 6.0

    /** Bumped when the app goes to the background (web: visibilitychange → hidden). Compose state. */
    var appBackgroundCount by mutableIntStateOf(0)
        private set

    /** Called by the platforms when the app leaves the screen (not for its own camera/picker/share sheet). */
    fun notifyAppBackground() {
        appBackgroundCount += 1
    }

    private fun requirePlatform(): DevicePlatform = platform ?: throw DeviceUnavailable()

    suspend fun takePhoto(maxEdge: Int = PHOTO_MAX_EDGE, quality: Double = PHOTO_QUALITY): ByteArray? {
        val p = requirePlatform()
        return awaitResult { done -> p.takePhoto(maxEdge, quality) { photo, error -> done(photo, error) } }
    }

    /** Photos from the library (empty when cancelled). Some unreadable pictures are skipped. */
    suspend fun pickPhotos(max: Int, maxEdge: Int = PHOTO_MAX_EDGE, quality: Double = PHOTO_QUALITY): List<ByteArray> {
        val p = requirePlatform()
        return awaitResult<List<ByteArray>> { done ->
            p.pickPhotos(max.coerceAtLeast(1), maxEdge, quality) { photos, error ->
                done(photos, if (error == DeviceError.PARTIAL) null else error)
            }
        }.orEmpty().take(max.coerceAtLeast(1))
    }

    /** Images and videos from the library. null = cancelled. */
    suspend fun pickFiles(): List<PickedFile>? {
        val p = requirePlatform()
        return awaitResult { done ->
            p.pickFiles { files, error -> done(files, if (error == DeviceError.PARTIAL) null else error) }
        }
    }

    suspend fun scaleImage(image: ByteArray, maxWidth: Int, maxHeight: Int, quality: Double): ByteArray? {
        val p = requirePlatform()
        return awaitResult { done -> p.scaleImage(image, maxWidth, maxHeight, quality) { jpeg -> done(jpeg, null) } }
    }

    /** src/lib/video-frames.ts framesFromVideo: JPEG every ~1.2 s, max 900 px wide, near-duplicates skipped. */
    suspend fun framesFromVideo(video: ByteArray): List<ByteArray> {
        val p = requirePlatform()
        val frames = awaitResult<List<VideoFrame>> { done ->
            p.videoFrames(video, sniffVideoMime(video), FRAME_STEP_SECONDS, FRAME_MAX_WIDTH, FRAME_VIDEO_QUALITY) { frames, error ->
                done(frames, error)
            }
        }.orEmpty()
        return dropNearDuplicates(frames)
    }

    /** src/lib/video-frames.ts frameFromImage: max 900 px wide JPEG (quality 0.8). */
    suspend fun frameFromImage(image: ByteArray): ByteArray? =
        scaleImage(image, FRAME_MAX_WIDTH, Int.MAX_VALUE, FRAME_IMAGE_QUALITY)

    /** On-device OCR. [tesseractLanguages] like the web's "dan+eng". */
    suspend fun recognizeText(image: ByteArray, tesseractLanguages: String = "dan+eng"): RecognizedText? {
        val p = requirePlatform()
        val languages = tesseractLanguages.split('+').mapNotNull { TESSERACT_TO_BCP47[it.trim()] }.ifEmpty { listOf("da-DK", "en-US") }
        return awaitResult { done -> p.recognizeText(image, languages) { text -> done(text, null) } }
    }

    suspend fun scanBarcode(): String? {
        val p = requirePlatform()
        return awaitResult { done -> p.scanBarcode { code, error -> done(code, error) } }
    }

    suspend fun decodeBarcode(image: ByteArray): String? {
        val p = requirePlatform()
        return awaitResult { done -> p.decodeBarcode(image) { code -> done(code, null) } }
    }

    suspend fun scanQrCode(): String? {
        val p = requirePlatform()
        return awaitResult { done -> p.scanQrCode { text, error -> done(text, error) } }
    }

    /**
     * Listens once and returns the final transcript (null = nothing heard).
     * Cancelling the coroutine stops the microphone.
     */
    suspend fun recognizeSpeech(languageTag: String, onPartial: (String) -> Unit): String? {
        val p = requirePlatform()
        return suspendCancellableCoroutine { cont ->
            cont.invokeOnCancellation { p.stopSpeech() }
            p.startSpeech(
                languageTag,
                { partial -> if (cont.isActive) onPartial(partial) },
                { transcript, error -> cont.finish(transcript, error) },
            )
        }
    }

    fun stopSpeech() {
        platform?.stopSpeech()
    }

    /** Share sheet; false when unavailable (the screens then copy/show a notice like the web). */
    fun share(title: String, text: String, url: String? = null): Boolean =
        runCatching { platform?.share(title, text, url) == true }.getOrDefault(false)

    fun canConfirmOwner(): Boolean = runCatching { platform?.canConfirmOwner() == true }.getOrDefault(false)

    suspend fun confirmOnDevice(reason: String = "Hello Cal"): Boolean {
        val p = platform ?: return false
        return awaitResult<Boolean> { done -> p.confirmOnDevice(reason) { ok -> done(ok, null) } } == true
    }

    fun passkeySupported(): Boolean = runCatching { platform?.passkeySupported() == true }.getOrDefault(false)

    fun hasPasskeyOnDevice(): Boolean = runCatching { platform?.hasPasskeyOnDevice() == true }.getOrDefault(false)

    /** Throws when the passkey could not be created (or passkeys are not supported yet). */
    suspend fun registerPasskey() {
        val p = requirePlatform()
        val error = awaitResult<String> { done -> p.registerPasskey { error -> done(error ?: "", null) } }
        if (!error.isNullOrEmpty()) throw DeviceUnavailable(error)
    }

    suspend fun enablePush(): String {
        val p = platform ?: return DeviceError.UNSUPPORTED
        return awaitResult<String> { done -> p.enablePush { status -> done(status, null) } } ?: "failed"
    }

    /**
     * web openHelpChat(): the help chat lives in the web layout. Natively the
     * Support page opens in the browser, where the chat button is.
     * TODO(parity): a native help chat screen.
     */
    fun openHelpChat() {
        NativeHooks.openExternalUrl(HelloCalConfig.BASE_URL + "/settings/support")
    }

    /** "data:image/jpeg;base64,…" — how the web sends photos to the API. */
    @OptIn(ExperimentalEncodingApi::class)
    fun jpegDataUrl(bytes: ByteArray): String = "data:image/jpeg;base64," + Base64.encode(bytes)

    /** video-frames.ts: keep a frame only when it differs from the last kept one (mean grey difference > 6). */
    internal fun dropNearDuplicates(frames: List<VideoFrame>): List<ByteArray> {
        val kept = mutableListOf<ByteArray>()
        var previous: ByteArray? = null
        for (frame in frames) {
            if (frameDifference(frame.grey16, previous) > SAME_FRAME_DIFF) {
                kept += frame.jpeg
                previous = frame.grey16
            }
        }
        return kept
    }

    internal fun frameDifference(a: ByteArray, b: ByteArray?): Double {
        if (b == null || a.isEmpty() || a.size != b.size) return Double.POSITIVE_INFINITY
        var sum = 0L
        for (i in a.indices) sum += abs((a[i].toInt() and 0xFF) - (b[i].toInt() and 0xFF))
        return sum.toDouble() / a.size
    }

    /** MP4/MOV share the "ftyp" box; brand "qt  " = QuickTime. */
    internal fun sniffVideoMime(bytes: ByteArray): String {
        if (bytes.size >= 12 && bytes.decodeToString(4, 8) == "ftyp") {
            return if (bytes.decodeToString(8, 12) == "qt  ") "video/quicktime" else "video/mp4"
        }
        return "video/mp4"
    }

    private val TESSERACT_TO_BCP47 = mapOf(
        "dan" to "da-DK", "eng" to "en-US", "swe" to "sv-SE", "nor" to "nb-NO", "deu" to "de-DE",
        "nld" to "nl-NL", "fra" to "fr-FR", "ita" to "it-IT", "spa" to "es-ES",
    )

    private suspend fun <T> awaitResult(start: (done: (T?, String?) -> Unit) -> Unit): T? =
        suspendCancellableCoroutine { cont -> start { value, error -> cont.finish(value, error) } }

    private fun <T> kotlinx.coroutines.CancellableContinuation<T?>.finish(value: T?, error: String?) {
        if (!isActive) return
        when (error) {
            null -> resume(value)
            DeviceError.DENIED -> resumeWithException(DevicePermissionDenied())
            else -> resumeWithException(DeviceUnavailable(error))
        }
    }
}

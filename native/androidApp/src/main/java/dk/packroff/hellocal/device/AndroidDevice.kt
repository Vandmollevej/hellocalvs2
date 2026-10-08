package dk.packroff.hellocal.device

import android.Manifest
import android.app.Application
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import dk.packroff.hellocal.MainActivity
import dk.packroff.hellocal.platform.DeviceError
import dk.packroff.hellocal.platform.DevicePlatform
import dk.packroff.hellocal.platform.PickedFile
import dk.packroff.hellocal.platform.RecognizedText
import dk.packroff.hellocal.platform.VideoFrame
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.File
import java.lang.ref.WeakReference
import kotlin.math.max
import kotlin.math.min

/**
 * Android side of the shared device layer (shared/.../platform/Device.kt).
 * The activity-result launchers live in [MainActivity] (registered before it
 * starts, so results survive the activity being re-created); this object keeps
 * the pending request as a CompletableDeferred and is set as Device.platform
 * in HelloCalApplication.
 */
object AndroidDevice : DevicePlatform {
    /** The photo picker's limit for one pick (PickMultipleVisualMedia needs it up front). */
    const val MAX_PICK = 20

    private lateinit var app: Application
    private val scope = MainScope()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var activityRef: WeakReference<MainActivity>? = null

    private var pendingPermission: CompletableDeferred<Boolean>? = null
    private var pendingPicture: CompletableDeferred<Boolean>? = null
    private var pendingPick: CompletableDeferred<List<Uri>>? = null

    /**
     * True while the app itself sent the user to another screen (camera app,
     * photo picker, scanner, share sheet, device-code screen): MainActivity's
     * onStop then does not count as "app went to the background".
     */
    @Volatile
    var expectingExternal = false
        private set

    fun init(application: Application) {
        app = application
    }

    // --- MainActivity wiring -------------------------------------------------

    fun attach(activity: MainActivity) {
        activityRef = WeakReference(activity)
    }

    fun detach(activity: MainActivity) {
        if (activityRef?.get() === activity) activityRef = null
    }

    fun onResumed() {
        expectingExternal = false
    }

    fun onPermissionResult(granted: Boolean) {
        expectingExternal = false
        pendingPermission?.complete(granted)
        pendingPermission = null
    }

    fun onPictureResult(saved: Boolean) {
        expectingExternal = false
        pendingPicture?.complete(saved)
        pendingPicture = null
    }

    fun onPickResult(uris: List<Uri>) {
        expectingExternal = false
        pendingPick?.complete(uris)
        pendingPick = null
    }

    private val activity: MainActivity? get() = activityRef?.get()

    private class Failure(val code: String) : Exception(code)

    /** Runs [block] on the main thread and reports (value, error) exactly once. */
    private fun <T> deliver(onResult: (T?, String?) -> Unit, block: suspend () -> T?) {
        scope.launch {
            val outcome: Pair<T?, String?> = try {
                block() to null
            } catch (e: CancellationException) {
                null to "cancelled-by-app"
            } catch (e: Failure) {
                null to e.code
            } catch (e: SecurityException) {
                null to DeviceError.DENIED
            } catch (e: ActivityNotFoundException) {
                null to DeviceError.UNAVAILABLE
            } catch (e: Exception) {
                null to (e.message ?: "failed")
            }
            onResult(value, error)
        }
    }

    private fun requireActivity(): MainActivity = activity ?: throw Failure(DeviceError.UNAVAILABLE)

    private suspend fun ensurePermission(permission: String): Boolean {
        if (ContextCompat.checkSelfPermission(app, permission) == PackageManager.PERMISSION_GRANTED) return true
        val activity = requireActivity()
        val deferred = CompletableDeferred<Boolean>()
        pendingPermission?.complete(false)
        pendingPermission = deferred
        expectingExternal = true
        activity.requestPermission.launch(permission)
        return deferred.await()
    }

    private suspend fun pickUris(limit: Int, mediaType: ActivityResultContracts.PickVisualMedia.VisualMediaType): List<Uri> {
        val activity = requireActivity()
        val deferred = CompletableDeferred<List<Uri>>()
        pendingPick?.complete(emptyList())
        pendingPick = deferred
        expectingExternal = true
        val request = PickVisualMediaRequest.Builder().setMediaType(mediaType).build()
        if (limit <= 1) activity.pickOne.launch(request) else activity.pickMany.launch(request)
        return deferred.await().take(limit.coerceAtLeast(1))
    }

    private suspend fun readUri(uri: Uri): ByteArray? = withContext(Dispatchers.IO) {
        runCatching { app.contentResolver.openInputStream(uri)?.use { it.readBytes() } }.getOrNull()
    }

    private fun onMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else mainHandler.post { block() }
    }

    // --- Camera and photo library ------------------------------------------------

    override fun takePhoto(maxEdge: Int, quality: Double, onResult: (ByteArray?, String?) -> Unit) = deliver(onResult) {
        if (!app.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) throw Failure(DeviceError.UNAVAILABLE)
        if (!ensurePermission(Manifest.permission.CAMERA)) throw Failure(DeviceError.DENIED)
        val activity = requireActivity()
        val dir = File(app.cacheDir, "camera").apply { mkdirs() }
        val file = File(dir, "photo-${System.currentTimeMillis()}.jpg")
        try {
            val uri = FileProvider.getUriForFile(app, "${app.packageName}.fileprovider", file)
            val deferred = CompletableDeferred<Boolean>()
            pendingPicture?.complete(false)
            pendingPicture = deferred
            expectingExternal = true
            activity.takePicture.launch(uri)
            if (!deferred.await() || !file.exists() || file.length() == 0L) return@deliver null
            withContext(Dispatchers.Default) { ImageTools.scaleJpeg(file.readBytes(), maxEdge, maxEdge, quality) }
                ?: throw Failure("failed")
        } finally {
            file.delete()
        }
    }

    override fun pickPhotos(max: Int, maxEdge: Int, quality: Double, onResult: (List<ByteArray>, String?) -> Unit) {
        scope.launch {
            val uris = try {
                pickUris(min(max, MAX_PICK), ActivityResultContracts.PickVisualMedia.ImageOnly)
            } catch (e: Failure) {
                onResult(emptyList(), e.code)
                return@launch
            } catch (e: Exception) {
                onResult(emptyList(), DeviceError.UNAVAILABLE)
                return@launch
            }
            val photos = withContext(Dispatchers.Default) {
                uris.mapNotNull { uri -> readUri(uri)?.let { ImageTools.scaleJpeg(it, maxEdge, maxEdge, quality) } }
            }
            onResult(photos, if (photos.size < uris.size) DeviceError.PARTIAL else null)
        }
    }

    override fun pickFiles(onResult: (List<PickedFile>?, String?) -> Unit) {
        scope.launch {
            val uris = try {
                pickUris(MAX_PICK, ActivityResultContracts.PickVisualMedia.ImageAndVideo)
            } catch (e: Failure) {
                onResult(null, e.code)
                return@launch
            } catch (e: Exception) {
                onResult(null, DeviceError.UNAVAILABLE)
                return@launch
            }
            if (uris.isEmpty()) {
                onResult(null, null)
                return@launch
            }
            val files = uris.mapNotNull { uri ->
                val bytes = readUri(uri) ?: return@mapNotNull null
                val mime = app.contentResolver.getType(uri) ?: if (looksLikeVideo(bytes)) "video/mp4" else "image/jpeg"
                PickedFile(mime, bytes)
            }
            onResult(files, if (files.size < uris.size) DeviceError.PARTIAL else null)
        }
    }

    override fun scaleImage(image: ByteArray, maxWidth: Int, maxHeight: Int, quality: Double, onResult: (ByteArray?) -> Unit) {
        scope.launch {
            val jpeg = withContext(Dispatchers.Default) { runCatching { ImageTools.scaleJpeg(image, maxWidth, maxHeight, quality) }.getOrNull() }
            onResult(jpeg)
        }
    }

    override fun videoFrames(
        video: ByteArray,
        mime: String,
        stepSeconds: Double,
        maxWidth: Int,
        quality: Double,
        onResult: (List<VideoFrame>, String?) -> Unit,
    ) {
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                val extension = if (mime.contains("quicktime")) "mov" else "mp4"
                val file = File(app.cacheDir, "import-video-${System.currentTimeMillis()}.$extension")
                val retriever = MediaMetadataRetriever()
                try {
                    file.writeBytes(video)
                    retriever.setDataSource(file.absolutePath)
                    val duration = (retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L) / 1000.0
                    val frames = mutableListOf<VideoFrame>()
                    // video-frames.ts: from 0.2 s, every step, the last clamped to just before the end.
                    var time = 0.2
                    while (time < max(duration, 0.3)) {
                        val at = min(time, max(0.0, duration - 0.05))
                        val frame = retriever.getFrameAtTime((at * 1_000_000).toLong(), MediaMetadataRetriever.OPTION_CLOSEST)
                        if (frame != null) {
                            val scaled = ImageTools.fit(frame, maxWidth, Int.MAX_VALUE)
                            frames += VideoFrame(ImageTools.jpeg(scaled, quality), ImageTools.grey16(scaled))
                            scaled.recycle()
                        }
                        time += stepSeconds
                    }
                    frames to null
                } catch (e: Exception) {
                    emptyList<VideoFrame>() to "failed"
                } finally {
                    runCatching { retriever.release() }
                    file.delete()
                }
            }
            onResult(result.first, result.second)
        }
    }

    // --- OCR and barcodes ------------------------------------------------------

    override fun recognizeText(image: ByteArray, languages: List<String>, onResult: (RecognizedText?) -> Unit) {
        scope.launch {
            val result = runCatching {
                val bitmap = withContext(Dispatchers.Default) { ImageTools.decode(image, 2400, 2400) } ?: return@runCatching null
                // ML Kit's Latin model covers every language the app offers (da, en, de, fr, nl, sv, no, it, es).
                val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                try {
                    val text = recognizer.process(InputImage.fromBitmap(bitmap, 0)).await()
                    val lines = text.textBlocks.flatMap { it.lines }
                    val confidence = if (lines.isEmpty()) 0.0 else lines.map { it.confidence.toDouble() }.average() * 100
                    RecognizedText(text.text, confidence)
                } finally {
                    recognizer.close()
                    bitmap.recycle()
                }
            }.getOrNull()
            onResult(result)
        }
    }

    private val productFormats = intArrayOf(Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E)

    override fun decodeBarcode(image: ByteArray, onResult: (String?) -> Unit) {
        scope.launch {
            val code = runCatching {
                val bitmap = withContext(Dispatchers.Default) { ImageTools.decode(image, 2400, 2400) } ?: return@runCatching null
                val options = BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_EAN_13, *productFormats).build()
                val scanner = BarcodeScanning.getClient(options)
                try {
                    scanner.process(InputImage.fromBitmap(bitmap, 0)).await().firstNotNullOfOrNull { it.rawValue }
                } finally {
                    scanner.close()
                    bitmap.recycle()
                }
            }.getOrNull()
            onResult(code)
        }
    }

    override fun scanBarcode(onResult: (String?, String?) -> Unit) =
        startCodeScanner(Barcode.FORMAT_EAN_13, productFormats, onResult)

    override fun scanQrCode(onResult: (String?, String?) -> Unit) =
        startCodeScanner(Barcode.FORMAT_QR_CODE, intArrayOf(), onResult)

    /** Google code scanner: Play services' own camera UI, no camera permission needed. */
    private fun startCodeScanner(format: Int, more: IntArray, onResult: (String?, String?) -> Unit) = onMain {
        val activity = activity
        if (activity == null) {
            onResult(null, DeviceError.UNAVAILABLE)
            return@onMain
        }
        var done = false
        fun finish(value: String?, error: String?) {
            if (done) return
            done = true
            expectingExternal = false
            onResult(value, error)
        }
        val options = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(format, *more).build()
        expectingExternal = true
        GmsBarcodeScanning.getClient(activity, options).startScan()
            .addOnSuccessListener { barcode -> finish(barcode.rawValue, null) }
            .addOnCanceledListener { finish(null, null) }
            .addOnFailureListener { finish(null, DeviceError.UNAVAILABLE) }
    }

    // --- Speech ----------------------------------------------------------------------

    private var recognizer: SpeechRecognizer? = null
    private var speechSession = 0

    override fun startSpeech(languageTag: String, onPartial: (String) -> Unit, onFinished: (String?, String?) -> Unit) {
        val session = ++speechSession
        scope.launch {
            destroyRecognizer()
            val allowed = try {
                ensurePermission(Manifest.permission.RECORD_AUDIO)
            } catch (e: Failure) {
                onFinished(null, e.code)
                return@launch
            }
            if (session != speechSession) {
                onFinished(null, null)
                return@launch
            }
            if (!allowed) {
                onFinished(null, DeviceError.DENIED)
                return@launch
            }
            if (!SpeechRecognizer.isRecognitionAvailable(app)) {
                onFinished(null, DeviceError.UNAVAILABLE)
                return@launch
            }
            val speech = SpeechRecognizer.createSpeechRecognizer(activity ?: app)
            recognizer = speech
            var heard = ""
            var finished = false
            fun finish(text: String?, error: String?) {
                if (finished) return
                finished = true
                if (recognizer === speech) recognizer = null
                speech.destroy()
                onFinished(text?.takeIf { it.isNotBlank() }, error)
            }
            speech.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) = Unit
                override fun onBeginningOfSpeech() = Unit
                override fun onRmsChanged(rmsdB: Float) = Unit
                override fun onBufferReceived(buffer: ByteArray?) = Unit
                override fun onEndOfSpeech() = Unit
                override fun onEvent(eventType: Int, params: Bundle?) = Unit

                override fun onPartialResults(partialResults: Bundle?) {
                    val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
                    if (finished || text.isBlank()) return
                    heard = text
                    onPartial(text)
                }

                override fun onResults(results: Bundle?) {
                    val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                    finish(text?.takeIf { it.isNotBlank() } ?: heard, null)
                }

                override fun onError(error: Int) {
                    when (error) {
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> finish(null, DeviceError.DENIED)
                        SpeechRecognizer.ERROR_NO_MATCH,
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
                        SpeechRecognizer.ERROR_CLIENT,
                        -> finish(heard, null)
                        else -> if (heard.isNotBlank()) finish(heard, null) else finish(null, "speech-$error")
                    }
                }
            })
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            speech.startListening(intent)
        }
    }

    override fun stopSpeech() = onMain {
        // A session still waiting for the microphone permission is dropped.
        speechSession++
        recognizer?.stopListening()
    }

    private fun destroyRecognizer() {
        recognizer?.let {
            recognizer = null
            runCatching { it.cancel() }
            runCatching { it.destroy() }
        }
    }

    // --- Share and confirmation ----------------------------------------------------

    override fun share(title: String, text: String, url: String?): Boolean {
        val context = activity ?: return false
        val body = listOfNotNull(
            text.takeIf { it.isNotBlank() },
            url?.takeIf { it.isNotBlank() && !text.contains(it) },
        ).joinToString("\n")
        if (body.isEmpty()) return false
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, body)
            if (title.isNotBlank()) putExtra(Intent.EXTRA_SUBJECT, title)
        }
        return try {
            expectingExternal = true
            context.startActivity(Intent.createChooser(send, title.ifBlank { null }))
            true
        } catch (e: ActivityNotFoundException) {
            expectingExternal = false
            false
        }
    }

    private val OWNER_AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL

    override fun canConfirmOwner(): Boolean =
        BiometricManager.from(app).canAuthenticate(OWNER_AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS

    override fun confirmOnDevice(reason: String, onResult: (Boolean) -> Unit) = onMain {
        val activity = activity
        if (activity == null) {
            onResult(false)
            return@onMain
        }
        var done = false
        fun finish(ok: Boolean) {
            if (done) return
            done = true
            expectingExternal = false
            onResult(ok)
        }
        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(app),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) = finish(true)
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) = finish(false)
                // onAuthenticationFailed = one wrong finger; the prompt stays open.
            },
        )
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(reason.ifBlank { "Hello Cal" })
            .setAllowedAuthenticators(OWNER_AUTHENTICATORS)
            .build()
        // On Android 10 and older the device-code screen is a separate activity.
        expectingExternal = true
        prompt.authenticate(info)
    }

    // --- Needs external accounts (see native/README.md) ----------------------------

    // TODO(platform): passkeys need Digital Asset Links (/.well-known/assetlinks.json
    // on hellocal.packroff.dk with the app's signing certificate) + androidx.credentials.
    override fun passkeySupported(): Boolean = false

    override fun hasPasskeyOnDevice(): Boolean = false

    override fun registerPasskey(onResult: (String?) -> Unit) = onResult(DeviceError.UNSUPPORTED)

    // TODO(platform): push needs a Firebase project (google-services.json) + FCM on the server.
    override fun enablePush(onResult: (String) -> Unit) = onResult(DeviceError.UNSUPPORTED)
}

/** "ftyp" box at offset 4 = MP4/MOV. */
private fun looksLikeVideo(bytes: ByteArray): Boolean =
    bytes.size >= 8 && bytes[4] == 'f'.code.toByte() && bytes[5] == 't'.code.toByte() &&
        bytes[6] == 'y'.code.toByte() && bytes[7] == 'p'.code.toByte()

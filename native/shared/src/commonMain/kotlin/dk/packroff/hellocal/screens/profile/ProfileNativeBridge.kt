package dk.packroff.hellocal.screens.profile

import dk.packroff.hellocal.platform.Device
import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

/**
 * Browser-only features the profile screens use (PORTING.md rule 7). Each
 * forwards to the shared device layer (platform/Device.kt) that the Android
 * and iPhone apps fill in at start-up; without it each falls back to the
 * web's behaviour when the feature is missing in the browser.
 */
object ProfileNativeBridge {
    private val confirmOnDeviceCall: suspend () -> Boolean = { Device.confirmOnDevice() }

    /**
     * FaceIdButton: can biometric login (a passkey) be set up here? Hidden when
     * false (as on the web). False until native passkeys are set up (Device.passkeySupported).
     */
    fun biometricAvailable(): Boolean = Device.passkeySupported()

    /** Is biometric login already set up on this device (web: hasPasskeyOnDevice)? */
    fun biometricEnabledOnDevice(): Boolean = Device.hasPasskeyOnDevice()

    /** Registers biometric login (web: registerPasskey via /api/auth/passkey/register/...). False on failure. */
    suspend fun enableBiometricLogin(): Boolean = try {
        Device.registerPasskey()
        true
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        false
    }

    /**
     * Photo diary lock: confirm the owner with Face ID/Touch ID/device code
     * (web: confirmOnDevice). null = not supported → the lock is just an extra tap, as on the web.
     */
    val confirmOnDevice: (suspend () -> Boolean)?
        get() = if (Device.canConfirmOwner()) confirmOnDeviceCall else null

    /**
     * Login approval by notification (web: enablePush in src/lib/push-client.ts):
     * ask for notification permission and register this device for push.
     * Returns "ok" | "unsupported" | "denied" | "not-configured" | "failed".
     */
    suspend fun enablePush(): String = Device.enablePush()

    /** The phone's share sheet (web: navigator.share). Returns false when unavailable — the text is then copied. */
    fun share(text: String): Boolean = Device.share("", text)

    /** "Tag billede" in the photo diary: the camera, returning a JPEG (max 1600 px, like prepareDiaryPhoto) or null. */
    suspend fun takePhoto(): ByteArray? = if (Device.available) Device.takePhoto() else null

    /** Where diary photos live — on the device only, never on the server (photo-diary-store.ts). */
    var photoStore: DiaryPhotoStore = SecureStorageDiaryPhotoStore

    /** Bumped by the platform when the app goes to the background (web: visibilitychange → hidden). */
    val backgroundCount: Int
        get() = Device.appBackgroundCount

    fun onAppBackground() = Device.notifyAppBackground()
}

data class StoredDiaryPhoto(val id: String, val takenAt: String, val bytes: ByteArray)

interface DiaryPhotoStore {
    suspend fun list(): List<StoredDiaryPhoto>
    suspend fun add(photo: StoredDiaryPhoto)
    suspend fun delete(id: String)
}

/**
 * Fallback store in the encrypted key/value storage (base64). Works on both
 * platforms; TODO(platform): a file-based store is lighter for many photos.
 */
@OptIn(ExperimentalEncodingApi::class)
object SecureStorageDiaryPhotoStore : DiaryPhotoStore {
    private const val INDEX_KEY = "hellocal.photoDiary.index"
    private fun photoKey(id: String) = "hellocal.photoDiary.photo.$id"

    @Serializable
    private data class Entry(val id: String, val takenAt: String)

    private val listSerializer = ListSerializer(Entry.serializer())

    private fun index(): List<Entry> = NativeHooks.secureStorage.get(INDEX_KEY)
        ?.let { runCatching { Json.decodeFromString(listSerializer, it) }.getOrNull() } ?: emptyList()

    private fun saveIndex(entries: List<Entry>) = NativeHooks.secureStorage.set(INDEX_KEY, Json.encodeToString(listSerializer, entries))

    override suspend fun list(): List<StoredDiaryPhoto> = index().mapNotNull { entry ->
        val data = NativeHooks.secureStorage.get(photoKey(entry.id)) ?: return@mapNotNull null
        StoredDiaryPhoto(entry.id, entry.takenAt, Base64.decode(data))
    }

    override suspend fun add(photo: StoredDiaryPhoto) {
        NativeHooks.secureStorage.set(photoKey(photo.id), Base64.encode(photo.bytes))
        saveIndex(listOf(Entry(photo.id, photo.takenAt)) + index().filter { it.id != photo.id })
    }

    override suspend fun delete(id: String) {
        NativeHooks.secureStorage.set(photoKey(id), null)
        saveIndex(index().filter { it.id != id })
    }
}

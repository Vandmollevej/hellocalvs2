package dk.packroff.hellocal.screens.profile

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

/**
 * Browser-only features the profile screens use (PORTING.md rule 7), as
 * hooks the Android and iPhone apps fill in at start-up — like NativeHooks.
 * TODO(platform): move these into platform/NativeHooks.kt (expect/actual)
 * and wire them in HelloCalApplication / iosApp. Until then each falls back
 * to the web's behaviour when the feature is missing in the browser.
 */
object ProfileNativeBridge {
    /** FaceIdButton: does the device have Face ID/Touch ID/fingerprint? Hidden when false (as on the web). */
    var biometricAvailable: () -> Boolean = { false }

    /** Is biometric login already set up on this device (web: hasPasskeyOnDevice)? */
    var biometricEnabledOnDevice: () -> Boolean = { false }

    /** Registers biometric login (web: registerPasskey via /api/auth/passkey/register/*). Throws/false on failure. */
    var enableBiometricLogin: suspend () -> Boolean = { false }

    /**
     * Photo diary lock: confirm the owner with Face ID/Touch ID/device code
     * (web: confirmOnDevice). null = not supported → the lock is just an extra tap, as on the web.
     */
    var confirmOnDevice: (suspend () -> Boolean)? = null

    /**
     * Login approval by notification (web: enablePush in src/lib/push-client.ts):
     * ask for notification permission and register this device for push.
     * Returns "ok" | "unsupported" | "denied" | "not-configured" | "failed".
     */
    var enablePush: suspend () -> String = { "unsupported" }

    /** The phone's share sheet (web: navigator.share). Returns false when unavailable — the text is then copied. */
    var share: (text: String) -> Boolean = { false }

    /** "Tag billede" in the photo diary: the camera, returning a JPEG (max 1600 px, like prepareDiaryPhoto) or null. */
    var takePhoto: suspend () -> ByteArray? = { null }

    /** Where diary photos live — on the device only, never on the server (photo-diary-store.ts). */
    var photoStore: DiaryPhotoStore = SecureStorageDiaryPhotoStore

    /** Bumped by the platform when the app goes to the background (web: visibilitychange → hidden). */
    var backgroundCount by mutableIntStateOf(0)
        private set

    fun onAppBackground() {
        backgroundCount += 1
    }
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

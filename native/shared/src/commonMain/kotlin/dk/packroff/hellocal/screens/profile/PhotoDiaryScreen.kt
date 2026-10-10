package dk.packroff.hellocal.screens.profile

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import dk.packroff.hellocal.ui.icons.HcIcon
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.ProfileCenteredText
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

/** A diary photo (src/lib/photo-diary.ts DiaryPhoto) — the bytes instead of an object URL. */
class DiaryPhoto(val id: String, val takenAt: String, val bytes: ByteArray)

/** Oldest first: the carousel and the viewer show the photos chronologically from left to right. */
fun sortOldestFirst(photos: List<DiaryPhoto>): List<DiaryPhoto> =
    photos.sortedBy { ProfileDates.parseInstant(it.takenAt)?.toEpochMilliseconds() ?: 0L }

/** A place in a ring of [count] photos — also for negative numbers, so the carousel loops both ways. */
fun wrapIndex(index: Int, count: Int): Int = ((index % count) + count) % count

/** "3. okt. 2026" */
fun formatPhotoDay(value: String) = ProfileDates.dayMonthYear(value)

/** "14.05" */
fun formatPhotoTime(value: String) = ProfileDates.time(value)

// The camera opened from "Tag billede" can send the app to the background.
// That must not lock the page, or the new photo would hide behind the lock.
private const val CAMERA_HIDE_GRACE_MS = 3000L

/**
 * Native port of src/app/profile/photo-diary/page.tsx (Seriøs only). Photos
 * are kept on the device only (ProfileNativeBridge.photoStore) — never in the
 * database. "Kræver telefonens adgangskode" is saved on the profile; when on,
 * the photos are only shown after Face ID/Touch ID/the phone's code, and the
 * page locks again when the app goes to the background. It is a viewing lock,
 * not encryption.
 */
@Composable
fun PhotoDiaryScreen(args: RouteArgs) {
    ProfilePremiumGate("photoDiary.title") { PhotoDiary() }
}

@OptIn(ExperimentalUuidApi::class)
@Composable
private fun PhotoDiary() {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var user by remember { mutableStateOf<ProfileUser?>(null) }
    var loading by remember { mutableStateOf(true) }
    var photos by remember { mutableStateOf<List<DiaryPhoto>>(emptyList()) }
    var photosLoaded by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    // load | save | delete
    var storageError by remember { mutableStateOf<String?>(null) }
    var locked by remember { mutableStateOf(false) }
    var unlocking by remember { mutableStateOf(false) }
    var unlockError by remember { mutableStateOf(false) }
    // The photo in the middle of the carousel (and in full screen). null = the newest.
    var activeId by remember { mutableStateOf<String?>(null) }
    var viewerOpen by remember { mutableStateOf(false) }
    // Before/after: the photo ticked as photo 1. Set = the overlay is open.
    var compareFirstId by remember { mutableStateOf<String?>(null) }
    var cameraOpenedAt by remember { mutableStateOf(0L) }

    val ordered = sortOldestFirst(photos)
    val activeIndex = maxOf(0, if (activeId != null) ordered.indexOfFirst { it.id == activeId } else ordered.size - 1)

    LaunchedEffect(Unit) {
        try {
            photos = ProfileNativeBridge.photoStore.list().map { DiaryPhoto(it.id, it.takenAt, it.bytes) }
        } catch (e: Exception) {
            storageError = "load"
        }
        photosLoaded = true
    }
    LaunchedEffect(Unit) {
        val loaded = runCatching { ProfileApi.loadUser() }.getOrNull()
        user = loaded
        locked = loaded?.photoDiaryRequiresPasscode == true
        loading = false
    }
    // Lock again when the app is left, so the photos are not showing the next time the phone is picked up.
    val backgroundCount = ProfileNativeBridge.backgroundCount
    LaunchedEffect(backgroundCount) {
        if (backgroundCount == 0) return@LaunchedEffect
        if (Clock.System.now().toEpochMilliseconds() - cameraOpenedAt < CAMERA_HIDE_GRACE_MS) return@LaunchedEffect
        locked = true
        viewerOpen = false
        compareFirstId = null
    }

    suspend fun unlock(): Boolean {
        unlockError = false
        // Without device confirmation the lock is just an extra tap, so the photos still do not show at once.
        val confirm = ProfileNativeBridge.confirmOnDevice
        if (confirm == null) {
            locked = false
            return true
        }
        unlocking = true
        val ok = runCatching { confirm() }.getOrDefault(false)
        unlocking = false
        if (ok) locked = false else unlockError = true
        return ok
    }

    fun toggleRequiresPasscode(value: Boolean) {
        scope.launch {
            // The lock cannot be turned off without confirmation while the photos are locked.
            if (!value && locked && !unlock()) return@launch
            user = user?.copy(photoDiaryRequiresPasscode = value)
            runCatching { ProfileApi.patch(mapOf("photoDiaryRequiresPasscode" to value)) }
        }
    }

    // The photo is only shown once it is saved — if saving fails, that is said out loud.
    fun openCamera() {
        cameraOpenedAt = Clock.System.now().toEpochMilliseconds()
        scope.launch {
            val bytes = runCatching { ProfileNativeBridge.takePhoto() }.getOrNull() ?: return@launch
            saving = true
            storageError = null
            try {
                val photo = StoredDiaryPhoto(Uuid.random().toString(), Clock.System.now().toString(), bytes)
                ProfileNativeBridge.photoStore.add(photo)
                photos = listOf(DiaryPhoto(photo.id, photo.takenAt, photo.bytes)) + photos
                // A new photo is the newest and therefore stands in the middle.
                activeId = null
            } catch (e: Exception) {
                storageError = "save"
            }
            saving = false
        }
    }

    suspend fun remove(id: String): Boolean {
        storageError = null
        return try {
            ProfileNativeBridge.photoStore.delete(id)
            photos = photos.filter { it.id != id }
            true
        } catch (e: Exception) {
            storageError = "delete"
            false
        }
    }

    fun selectIndex(index: Int) {
        activeId = ordered.getOrNull(index)?.id
    }

    fun onViewerDelete(id: String) {
        val deletedIndex = ordered.indexOfFirst { it.id == id }
        val remaining = ordered.filter { it.id != id }
        scope.launch {
            if (!remove(id)) return@launch
            if (remaining.isEmpty()) {
                activeId = null
                viewerOpen = false
                return@launch
            }
            // Show the previous (older) photo; deleting the oldest continues the loop from the newest.
            activeId = remaining[wrapIndex(deletedIndex - 1, remaining.size)].id
        }
    }

    HcScreen(title = t.t("photoDiary.title"), contentPadding = ProfilePagePadding) {
        val current = user
        when {
            loading -> HcLoader()
            current == null -> ProfileCenteredText(t.t("photoDiary.loadError"))
            else -> ProfilePage {
                HcToggle(
                    checked = current.photoDiaryRequiresPasscode,
                    onChange = ::toggleRequiresPasscode,
                    label = t.t("photoDiary.requiresPasscode"),
                    description = t.t("photoDiary.requiresPasscodeDescription"),
                )
                if (locked && current.photoDiaryRequiresPasscode) {
                    HcButton(
                        if (unlocking) t.t("photoDiary.unlocking") else t.t("photoDiary.showPhotos"),
                        onClick = { scope.launch { unlock() } },
                        enabled = !unlocking,
                    )
                    if (unlockError) HcText(t.t("photoDiary.unlockError"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center)
                } else {
                    // The photos (or "no photos yet") always stand above the button with plenty of air.
                    androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 32.dp)) {
                        if (photosLoaded) {
                            if (ordered.isEmpty()) {
                                HcText(t.t("photoDiary.noPhotosYet"), HcTypeRoles.Small, Modifier.fillMaxWidth().padding(vertical = 32.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                            } else {
                                PhotoCarousel(
                                    photos = ordered,
                                    index = activeIndex,
                                    onIndexChange = ::selectIndex,
                                    onOpen = { index ->
                                        selectIndex(index)
                                        viewerOpen = true
                                    },
                                    selectedId = compareFirstId,
                                    onSelect = { index -> compareFirstId = ordered.getOrNull(index)?.id },
                                )
                            }
                        }
                    }
                }
                // The add button always stands in the middle with a big camera — also while the photos are locked.
                Column(Modifier.fillMaxWidth().padding(vertical = 48.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(
                        Modifier
                            .size(112.dp)
                            .shadow(8.dp, CircleShape)
                            .clip(CircleShape)
                            .background(HcColors.Green)
                            .alpha(if (saving) 0.5f else 1f)
                            .clickable(enabled = !saving, onClick = ::openCamera),
                        contentAlignment = Alignment.Center,
                    ) { HcIcon("Camera", size = 56.dp, stroke = 1.6f, color = HcColors.White, contentDescription = t.t("photoDiary.takePhoto")) }
                    HcText(if (saving) t.t("photoDiary.saving") else t.t("photoDiary.addPhoto"), HcTypeRoles.Button, color = HcColors.Black, align = TextAlign.Center)
                    storageError?.let { kind ->
                        HcText(
                            t.t(
                                when (kind) {
                                    "load" -> "photoDiary.storageLoadError"
                                    "save" -> "photoDiary.saveError"
                                    else -> "photoDiary.deleteError"
                                },
                            ),
                            HcTypeRoles.Small,
                            Modifier.fillMaxWidth(),
                            color = HcColors.RedDark,
                            align = TextAlign.Center,
                        )
                    }
                }
            }
        }
    }

    if (viewerOpen && ordered.getOrNull(activeIndex) != null) {
        PhotoViewer(
            photos = ordered,
            index = activeIndex,
            onIndexChange = ::selectIndex,
            onClose = { viewerOpen = false },
            onDelete = ::onViewerDelete,
        )
    }
    val firstId = compareFirstId
    if (firstId != null && !(locked && user?.photoDiaryRequiresPasscode == true)) {
        PhotoCompare(photos = ordered, firstId = firstId, onClose = { compareFirstId = null })
    }
}

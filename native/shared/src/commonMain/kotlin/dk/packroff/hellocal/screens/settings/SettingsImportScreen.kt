package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.Device
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.math.roundToInt

// Migration from MyFitnessPal / Lifesum (docs/DECISIONS.md 2026-10-06):
// 1) choose app, 2) choose a screen recording (or screenshots) of the diary,
// 3) every frame is read by AI, 4) the user reviews the rows and imports the
// chosen ones as registrations. The pictures are not stored.

/** One row read from the recording (MigrationImportRow, GET /api/migration-import/[id]). */
@Serializable
data class SettingsImportRowDto(
    val id: String,
    val date: String = "",
    val meal: String = "",
    val name: String = "",
    val amountText: String? = null,
    val kcal: Double = 0.0,
    val protein: Double? = null,
    val carbs: Double? = null,
    val fat: Double? = null,
    val confidence: Double = 0.0,
    val status: String = "PENDING",
)

/** A file the user picked (web: file input accepting videos and images, multiple). */
class SettingsImportPickedFile(val mime: String, val bytes: ByteArray)

/**
 * Phone features for this screen (web: a file input plus canvas/video decoding
 * in src/lib/video-frames.ts), forwarded to the shared device layer
 * (platform/Device.kt):
 *  - [pickFiles]: system picker for videos and images (multiple). Null result = cancelled.
 *  - [framesFromVideo]: a JPEG data URL ("data:image/jpeg;base64,...") every ~1.2 s,
 *    max 900 px wide, quality 0.75, near-identical frames skipped (16x16 grey
 *    fingerprint, mean difference above 6).
 *  - [frameFromImage]: the picture down-scaled to max 900 px wide as a JPEG data URL (quality 0.8).
 * Without a platform the hooks are null (no picker; pictures sent unscaled).
 */
object SettingsImportMedia {
    private val pickFilesCall: suspend () -> List<SettingsImportPickedFile>? = {
        Device.pickFiles()?.map { SettingsImportPickedFile(it.mime, it.bytes) }
    }
    private val framesFromVideoCall: suspend (ByteArray) -> List<String> = { bytes ->
        Device.framesFromVideo(bytes).map { Device.jpegDataUrl(it) }
    }
    private val frameFromImageCall: suspend (ByteArray, String) -> String = { bytes, mime ->
        Device.frameFromImage(bytes)?.let { Device.jpegDataUrl(it) } ?: settingsImportDataUrl(bytes, mime)
    }

    val pickFiles: (suspend () -> List<SettingsImportPickedFile>?)?
        get() = if (Device.available) pickFilesCall else null
    val framesFromVideo: (suspend (bytes: ByteArray) -> List<String>)?
        get() = if (Device.available) framesFromVideoCall else null
    val frameFromImage: (suspend (bytes: ByteArray, mime: String) -> String)?
        get() = if (Device.available) frameFromImageCall else null
}

private enum class SettingsImportPhase { Pick, Reading, Review, Done }

private data class SettingsImportSource(val value: String, val label: String)

private val SETTINGS_IMPORT_SOURCES = listOf(
    SettingsImportSource("MYFITNESSPAL", "MyFitnessPal"),
    SettingsImportSource("LIFESUM", "Lifesum"),
)
private val SETTINGS_IMPORT_MEAL_ORDER = listOf("breakfast", "lunch", "snack", "dinner")
private const val SETTINGS_IMPORT_SURE = 0.6

/** Today in Copenhagen as YYYY-MM-DD (web: Intl sv-SE in Europe/Copenhagen). */
private fun settingsImportToday(): String = Clock.System.now().toLocalDateTime(settingsCopenhagenZone()).date.toString()

@OptIn(ExperimentalEncodingApi::class)
private fun settingsImportDataUrl(bytes: ByteArray, mime: String): String = "data:$mime;base64," + Base64.encode(bytes)

/** Native port of src/app/settings/import/page.tsx. */
@Composable
fun SettingsImportScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var source by remember { mutableStateOf("MYFITNESSPAL") }
    var phase by remember { mutableStateOf(SettingsImportPhase.Pick) }
    var progressDone by remember { mutableStateOf(0) }
    var progressTotal by remember { mutableStateOf(0) }
    var importId by remember { mutableStateOf<String?>(null) }
    var rows by remember { mutableStateOf<List<SettingsImportRowDto>>(emptyList()) }
    var selected by remember { mutableStateOf<Set<String>>(emptySet()) }
    var error by remember { mutableStateOf<String?>(null) }
    var imported by remember { mutableStateOf(0) }
    var busy by remember { mutableStateOf(false) }

    suspend fun start(files: List<SettingsImportPickedFile>) {
        if (files.isEmpty()) return
        error = null
        phase = SettingsImportPhase.Reading
        progressDone = 0
        progressTotal = 0
        try {
            val created = Api.post("/api/migration-import", mapOf("source" to source)).jsonObject
            val id = created["import"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull ?: throw IllegalStateException("create")
            importId = id

            val frames = mutableListOf<String>()
            for (file in files) {
                when {
                    file.mime.startsWith("video/") -> frames += SettingsImportMedia.framesFromVideo?.invoke(file.bytes).orEmpty()
                    file.mime.startsWith("image/") ->
                        frames += SettingsImportMedia.frameFromImage?.invoke(file.bytes, file.mime) ?: settingsImportDataUrl(file.bytes, file.mime)
                }
            }
            progressTotal = frames.size

            var contextDate: String? = null
            var failed = 0
            frames.forEachIndexed { index, photo ->
                try {
                    val data = Api.post(
                        "/api/migration-import/$id/frames",
                        mapOf("photo" to photo, "contextDate" to contextDate, "today" to settingsImportToday()),
                    ) as? JsonObject
                    contextDate = data?.get("date")?.jsonPrimitive?.contentOrNull ?: contextDate
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    failed += 1
                }
                progressDone = index + 1
            }
            if (failed == frames.size && frames.isNotEmpty()) throw IllegalStateException("frames")

            val rowsJson = Api.get("/api/migration-import/$id").jsonObject["import"]?.jsonObject?.get("rows")
            val list = if (rowsJson == null) emptyList() else ApiJson.decodeFromJsonElement(ListSerializer(SettingsImportRowDto.serializer()), rowsJson)
            rows = list
            selected = list.filter { it.status == "PENDING" && it.confidence >= SETTINGS_IMPORT_SURE }.map { it.id }.toSet()
            phase = SettingsImportPhase.Review
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            error = t.t("migrationImport.readError")
            phase = SettingsImportPhase.Pick
        }
    }

    fun choose() {
        // web <input type="file" accept="video/*,image/*" multiple> → the system picker (Device.pickFiles).
        val picker = SettingsImportMedia.pickFiles ?: return
        scope.launch {
            val files = runCatching { picker() }.getOrNull() ?: return@launch
            start(files)
        }
    }

    fun commit() {
        val id = importId ?: return
        busy = true
        scope.launch {
            try {
                val data = Api.post("/api/migration-import/$id/commit", mapOf("rowIds" to selected.toList())) as? JsonObject
                imported = data?.get("imported")?.jsonPrimitive?.intOrNull ?: 0
                NativeHooks.onRegistrationChanged()
                phase = SettingsImportPhase.Done
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = t.t("migrationImport.commitError")
            } finally {
                busy = false
            }
        }
    }

    fun toggle(id: String) {
        selected = if (id in selected) selected - id else selected + id
    }

    HcScreen(title = t.t("migrationImport.title"), contentPadding = SettingsPagePadding) {
        SettingsPage(gap = HcDimens.SpaceBlock) {
            when (phase) {
                SettingsImportPhase.Pick -> {
                    SettingsHelpTip(t.t("migrationImport.intro"))
                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        HcText(t.t("migrationImport.fromApp"), HcTypeRoles.Label, color = HcColors.TextSecondary)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            SETTINGS_IMPORT_SOURCES.forEach { option ->
                                SettingsImportChoice(option.label, selected = source == option.value, modifier = Modifier.weight(1f)) {
                                    source = option.value
                                }
                            }
                        }
                    }
                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("migrationImport.step1", "migrationImport.step2", "migrationImport.step3").forEachIndexed { index, key ->
                            Row(Modifier.fillMaxWidth()) {
                                HcText("${index + 1}.", HcTypeRoles.Body, Modifier.padding(end = 6.dp), color = HcColors.TextSecondary)
                                HcText(t.t(key), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.TextSecondary)
                            }
                        }
                    }
                    HcButton(t.t("migrationImport.choose"), onClick = ::choose)
                    HcText(t.t("migrationImport.privacy"), HcTypeRoles.Small, color = HcColors.Inactive)
                    val message = error
                    if (message != null) HcText(message, HcTypeRoles.Body, color = HcColors.RedDark)
                }

                SettingsImportPhase.Reading -> {
                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        HcText(
                            if (progressTotal > 0) t.t("migrationImport.reading", "done" to progressDone, "total" to progressTotal)
                            else t.t("migrationImport.preparing"),
                            HcTypeRoles.Body,
                            color = HcColors.Black,
                        )
                        val fraction = if (progressTotal > 0) progressDone.toFloat() / progressTotal else 0.05f
                        Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(50)).background(HcColors.Tan)) {
                            Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).fillMaxHeight().background(HcColors.Green))
                        }
                    }
                }

                SettingsImportPhase.Review -> {
                    HcText(
                        if (rows.isNotEmpty()) t.t("migrationImport.reviewHint") else t.t("migrationImport.nothingFound"),
                        HcTypeRoles.Body,
                        color = HcColors.TextSecondary,
                    )
                    val byDate = rows.groupBy { it.date }.entries
                        .sortedByDescending { it.key }
                        .map { (date, list) -> date to list.sortedBy { SETTINGS_IMPORT_MEAL_ORDER.indexOf(it.meal) } }
                    byDate.forEach { (date, list) ->
                        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            HcText(date, HcTypeRoles.Title, color = HcColors.Black)
                            list.forEach { row ->
                                SettingsImportRowItem(row, checked = row.id in selected, t = t) { toggle(row.id) }
                            }
                        }
                    }
                    val message = error
                    if (message != null) HcText(message, HcTypeRoles.Body, color = HcColors.RedDark)
                    HcButton(
                        t.t("migrationImport.importSelected", "count" to selected.size),
                        onClick = ::commit,
                        enabled = !busy && selected.isNotEmpty(),
                    )
                }

                SettingsImportPhase.Done -> {
                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        HcText(t.t("migrationImport.done", "count" to imported), HcTypeRoles.Body, color = HcColors.Black)
                        HcButton(t.t("migrationImport.openCalendar"), onClick = { nav.push("/calendar") })
                    }
                }
            }
        }
    }
}

/** .hf-choice radio button (min 40 px, card colour; selected = lime with a 2 px dark ring). */
@Composable
private fun SettingsImportChoice(label: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Box(
        modifier
            .heightIn(min = 40.dp)
            .clip(shape)
            .background(if (selected) HcColors.SelectedBg else HcColors.Card, shape)
            .let { if (selected) it.border(2.dp, HcColors.SelectedBorder, shape) else it }
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        HcText(label, HcTypeRoles.Small, color = if (selected) HcColors.SelectedText else HcColors.Text, bold = true, align = TextAlign.Center)
    }
}

/** One reviewed row: on/off, name, meal · amount · unsure, kcal. */
@Composable
private fun SettingsImportRowItem(row: SettingsImportRowDto, checked: Boolean, t: Translator, onToggle: () -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = HcDimens.ControlHeight)
            .clip(shape)
            .background(HcColors.Surface, shape)
            .border(1.dp, HcColors.Nav, shape)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // The web uses a checkbox here; the app's only on/off control is the toggle (DECISIONS 2026-09-02).
        HcToggle(checked = checked, onChange = { onToggle() }, enabled = row.status == "PENDING")
        Column(Modifier.weight(1f)) {
            HcText(row.name, HcTypeRoles.Body, color = HcColors.Black, maxLines = 1)
            val details = buildString {
                append(t.t("migrationImport.meal.${row.meal}"))
                if (!row.amountText.isNullOrEmpty()) append(" · ${row.amountText}")
                if (row.confidence < SETTINGS_IMPORT_SURE) append(" · ${t.t("migrationImport.unsure")}")
            }
            HcText(details, HcTypeRoles.Small, color = HcColors.Inactive, maxLines = 1)
        }
        HcText("${row.kcal.roundToInt()} kcal", HcTypeRoles.Body, color = HcColors.Black)
    }
}

package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.height
import androidx.compose.ui.layout.ContentScale
import dk.packroff.hellocal.platform.Device
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.SettingsSupportBytesImage
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfilePointsPromoBanner
import dk.packroff.hellocal.ui.ProfileTextArea
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject

@Serializable
private data class BugReport(
    val id: String,
    val description: String = "",
    val status: String = "",
    val categories: List<String>? = null,
    val sections: Map<String, String>? = null,
    val sectionPhotos: Map<String, String>? = null,
)

@Serializable
private data class BugReportNote(val id: String, val text: String, val createdAt: String)

/** Four icon buttons that tag which part of the product's data is wrong (prisma BugReportCategory). */
private val BUG_REPORT_CATEGORIES = listOf(
    Triple("EAN", "EAN", "Barcode"),
    Triple("ENERGY", "Energi", "Bolt"),
    Triple("CONTENT", "Indhold", "List"),
    Triple("PRODUCT_IMAGE", "Varebillede", "Photo"),
)

/** src/lib/bug-report-sections.ts — the product's sections a report from a product is split into. */
private val BUG_REPORT_SECTIONS = listOf(
    "IMAGE" to "Billede",
    "TITLE" to "Titel / varetype",
    "ENERGY" to "Energifordeling",
    "INGREDIENTS" to "Ingredienser",
    "CERTIFICATES" to "Certifikater",
    "OTHER" to "Øvrige varedata",
)

private fun decodeReport(element: kotlinx.serialization.json.JsonElement?): BugReport? =
    element?.takeIf { it is JsonObject }?.let { runCatching { ApiJson.decodeFromJsonElement(BugReport.serializer(), it) }.getOrNull() }

/**
 * Native port of src/app/profile/report-bug/page.tsx ("Indberet fejl",
 * docs/DECISIONS.md 2026-09-02): 10 points when approved. From a product's
 * link (?productId=) the report is tied to the product and split into its
 * sections; only one pending correction per product — a new attempt shows
 * "Redigér" instead of another form. The page hard-codes Danish.
 */
@Composable
fun ReportBugScreen(args: RouteArgs) {
    val productId = args.opt("productId")
    key(productId) { ReportBugContent(productId) }
}

@Composable
private fun ReportBugContent(productId: String?) {
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var description by remember { mutableStateOf("") }
    val categories = remember { mutableStateListOf<String>() }
    // An open section = a key in the map, also while empty.
    val sections = remember { mutableStateMapOf<String, String>() }
    // A photo per section: a data URL from the camera, or a stored path while editing (+ the bytes for the preview).
    val photos = remember { mutableStateMapOf<String, String>() }
    val photoBytes = remember { mutableStateMapOf<String, ByteArray>() }
    var openSection by remember { mutableStateOf<String?>(null) }
    // Black thank-you box instead of the banner after a submission.
    var thanked by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var submitting by remember { mutableStateOf(false) }
    // false while the product's pending report is still loading (web: pending === undefined).
    var pendingLoaded by remember { mutableStateOf(productId == null) }
    var pending by remember { mutableStateOf<BugReport?>(null) }
    var editing by remember { mutableStateOf(false) }
    // The note is folded behind a "Note" header, so the category chips are seen first.
    var noteOpen by remember { mutableStateOf(false) }

    LaunchedEffect(productId) {
        if (productId == null) return@LaunchedEffect
        pending = runCatching { decodeReport((Api.get("/api/bug-reports?productId=${Location.encode(productId)}") as JsonObject)["bugReport"]) }.getOrNull()
        pendingLoaded = true
    }

    fun startEditing(report: BugReport) {
        description = report.description
        categories.clear()
        categories.addAll(report.categories ?: emptyList())
        noteOpen = true
        sections.clear()
        sections.putAll(report.sections ?: emptyMap())
        photos.clear()
        photoBytes.clear()
        photos.putAll(report.sectionPhotos ?: emptyMap())
        thanked = false
        editing = true
    }

    fun submit() {
        error = null
        if (productId != null && sections.values.none { it.isNotBlank() } && photos.isEmpty()) {
            error = "Vælg mindst ét punkt og beskriv, hvad der er forkert"
            return
        }
        if (productId == null && description.trim().length < 10) {
            noteOpen = true
            error = "Beskriv fejlen med mindst 10 tegn"
            return
        }
        submitting = true
        val editingExisting = if (editing) pending else null
        val body: Map<String, Any?> = when {
            productId != null && editingExisting != null -> mapOf("sections" to sections.toMap(), "sectionPhotos" to photos.toMap())
            productId != null -> mapOf("sections" to sections.toMap(), "sectionPhotos" to photos.toMap(), "productId" to productId)
            else -> mapOf("description" to description, "categories" to categories.toList())
        }
        scope.launch {
            try {
                val response = if (editingExisting != null) Api.patch("/api/bug-reports/${editingExisting.id}", body) else Api.post("/api/bug-reports", body)
                pending = decodeReport((response as? JsonObject)?.get("bugReport"))
                editing = false
                sections.clear()
                photos.clear()
                photoBytes.clear()
                thanked = true
            } catch (e: ApiException) {
                // Race with another device that already submitted one — show the overlay instead.
                val existing = decodeReport((e.body as? JsonObject)?.get("bugReport"))
                if (e.status == 409 && existing != null) {
                    pending = existing
                    editing = false
                } else {
                    error = e.message.ifBlank { "Kunne ikke sende fejlrapporten" }
                }
            } catch (e: Exception) {
                error = "Kunne ikke sende fejlrapporten — tjek din forbindelse og prøv igen"
            }
            submitting = false
        }
    }

    val current = pending
    val showOverlay = current != null && !editing
    val showForm = if (productId == null) current == null else editing || (pendingLoaded && current == null)

    HcScreen(title = "Har du fundet en fejl?", contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp)) {
        if (thanked) {
            val shape = RoundedCornerShape(HcDimens.RadiusCard)
            Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Black, shape).padding(16.dp)) {
                HcText(
                    "TAK! Vi har modtaget din indberetning. Du vil få svar på din henvendelse og points i din indbakke, når vi har behandlet din sag.",
                    HcTypeRoles.Body,
                    color = HcColors.White,
                )
            }
        } else {
            ProfilePointsPromoBanner(
                headline = "Indberet en fejl og optjen 10 points, når den godkendes og rettes.",
                onTermsClick = { nav.push("/betingelser#pointsystem") },
            )
        }
        when {
            !pendingLoaded -> HcText("Henter…", HcTypeRoles.Body, Modifier.padding(top = 32.dp), color = HcColors.TextSecondary)
            showOverlay && current != null -> Column(
                Modifier.fillMaxWidth().padding(top = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                HcText("Vi har modtaget din rettelse som afventer gennemgang", HcTypeRoles.Body, align = TextAlign.Center)
                HcButton("Redigér", onClick = { startEditing(current) }, kind = HcButtonKind.Secondary)
                Column(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 32.dp)) { BugReportNotes(current.id) }
            }
            showForm -> Column(Modifier.fillMaxWidth().padding(top = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                if (productId != null) {
                    HcText("Hvad er forkert på varen?", HcTypeRoles.Label)
                    BUG_REPORT_SECTIONS.forEach { (sectionKey, label) ->
                        val filled = !sections[sectionKey].isNullOrBlank() || photos.containsKey(sectionKey)
                        val shape = RoundedCornerShape(HcDimens.RadiusCard)
                        Row(
                            Modifier.fillMaxWidth().clip(shape)
                                .border(1.dp, if (filled) HcColors.Action else HcColors.FieldBorder, shape)
                                .clickable { openSection = sectionKey }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            HcText(label, HcTypeRoles.Body, Modifier.weight(1f))
                            HcIcon(if (filled) "Check" else "Plus", size = 20.dp, stroke = 1.75f, color = HcColors.Action)
                        }
                    }
                    HcError(error)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(Modifier.fillMaxWidth().clickable { noteOpen = !noteOpen }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            HcText("Note", HcTypeRoles.Label, Modifier.weight(1f))
                            HcIcon("ChevronDown", size = 20.dp, stroke = 1.75f, color = HcColors.Action, modifier = Modifier.rotate(if (noteOpen) 180f else 0f))
                        }
                        if (noteOpen) {
                            ProfileTextArea(description, { description = it }, placeholder = "Hvad skete der, og hvad forventede du i stedet?", minLines = 6)
                        }
                    }
                    HcError(error)
                    Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        BUG_REPORT_CATEGORIES.forEach { (value, label, icon) ->
                            val selected = value in categories
                            val shape = RoundedCornerShape(HcDimens.RadiusCard)
                            Column(
                                Modifier.weight(1f).clip(shape)
                                    .background(if (selected) HcColors.Action else HcColors.Page, shape)
                                    .border(1.dp, if (selected) HcColors.Action else HcColors.FieldBorder, shape)
                                    .clickable { if (selected) categories.remove(value) else categories.add(value) }
                                    .padding(8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                val color = if (selected) HcColors.White else HcColors.Action
                                HcIcon(icon, size = 22.dp, stroke = 1.75f, color = color)
                                HcText(label, HcTypeRoles.Caption, color = color, align = TextAlign.Center)
                            }
                        }
                    }
                }
                HcButton(
                    if (submitting) "Sender…" else "Send indberetning",
                    onClick = ::submit,
                    enabled = !submitting,
                    modifier = Modifier.padding(top = 8.dp, bottom = 112.dp),
                )
            }
        }
    }

    val sheetKey = openSection
    if (sheetKey != null) {
        val label = BUG_REPORT_SECTIONS.firstOrNull { it.first == sheetKey }?.second ?: ""
        BugReportSectionSheet(
            label = label,
            text = sections[sheetKey] ?: "",
            photo = photos[sheetKey],
            photoBytes = photoBytes[sheetKey],
            onText = { sections[sheetKey] = it },
            onPhoto = { bytes ->
                if (bytes == null) {
                    photos.remove(sheetKey)
                    photoBytes.remove(sheetKey)
                } else {
                    photos[sheetKey] = Device.jpegDataUrl(bytes)
                    photoBytes[sheetKey] = bytes
                }
            },
            onDismiss = { openSection = null },
        )
    }
}

/**
 * The bottom sheet for one point (user decision 2026-10-10): the point as the
 * title, a note field and under it the camera, so a new photo can be taken
 * right away. "Gem" only closes the sheet — the black "Send indberetning"
 * button on the page sends.
 */
@Composable
private fun BugReportSectionSheet(
    label: String,
    text: String,
    photo: String?,
    photoBytes: ByteArray?,
    onText: (String) -> Unit,
    onPhoto: (ByteArray?) -> Unit,
    onDismiss: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var photoError by remember { mutableStateOf<String?>(null) }
    HcBottomSheet(
        onDismiss = onDismiss,
        title = label,
        size = HcSheetSize.Full,
        scrollable = true,
        footer = { HcButton("Gem", onClick = onDismiss, modifier = Modifier.fillMaxWidth()) },
    ) {
        Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            ProfileTextArea(text, onText, placeholder = "Hvad er forkert, og hvad burde der stå?", minLines = 5)
            if (photo != null) {
                val shape = RoundedCornerShape(HcDimens.RadiusCard)
                val imageModifier = Modifier.fillMaxWidth().height(256.dp).clip(shape).border(1.dp, HcColors.FieldBorder, shape)
                if (photoBytes != null) SettingsSupportBytesImage(photoBytes, imageModifier, ContentScale.Fit)
                else HcRemoteImage(photo, imageModifier, label, ContentScale.Fit)
            }
            HcButton(
                if (photo != null) "Tag nyt billede" else "Tag billede",
                onClick = {
                    photoError = null
                    scope.launch {
                        try {
                            Device.takePhoto()?.let { onPhoto(it) }
                        } catch (e: Exception) {
                            photoError = "Kunne ikke tage billedet — prøv igen"
                        }
                    }
                },
                kind = HcButtonKind.Secondary,
                modifier = Modifier.fillMaxWidth(),
            )
            if (photo != null) HcButton("Fjern billede", onClick = { onPhoto(null) }, kind = HcButtonKind.Text)
            HcError(photoError)
        }
    }
}

/** src/components/BugReportNotes.tsx — the user's notes on a pending report and a field to add one. */
@Composable
private fun BugReportNotes(bugReportId: String) {
    val scope = rememberCoroutineScope()
    var notes by remember { mutableStateOf<List<BugReportNote>>(emptyList()) }
    var text by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }

    LaunchedEffect(bugReportId) {
        notes = runCatching {
            val list = (Api.get("/api/bug-reports/$bugReportId/notes") as JsonObject)["notes"]!!
            ApiJson.decodeFromJsonElement(ListSerializer(BugReportNote.serializer()), list)
        }.getOrDefault(emptyList())
    }

    fun submit() {
        if (text.isBlank()) return
        error = null
        saving = true
        scope.launch {
            try {
                val response = Api.post("/api/bug-reports/$bugReportId/notes", mapOf("text" to text)) as JsonObject
                response["note"]?.let { notes = notes + ApiJson.decodeFromJsonElement(BugReportNote.serializer(), it) }
                text = ""
            } catch (e: ApiException) {
                error = e.message.ifBlank { "Kunne ikke gemme noten" }
            } catch (e: Exception) {
                error = "Kunne ikke gemme noten — tjek din forbindelse og prøv igen"
            } finally {
                saving = false
            }
        }
    }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HcText("Noter", HcTypeRoles.Label)
        if (notes.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                notes.forEach { note ->
                    val shape = RoundedCornerShape(2.dp)
                    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Cream, shape).border(1.dp, HcColors.FieldBorder, shape).padding(12.dp)) {
                        HcText(ProfileDates.shortDateTime(note.createdAt), HcTypeRoles.Caption, color = HcColors.TextSecondary)
                        HcText(note.text, HcTypeRoles.Body)
                    }
                }
            }
        }
        ProfileTextArea(text, { text = it }, placeholder = "Skriv en note til din indberetning", minLines = 3, maxLength = 1000)
        HcError(error)
        HcButton(if (saving) "Gemmer…" else "Tilføj note", onClick = ::submit, kind = HcButtonKind.Secondary, enabled = !saving && text.isNotBlank())
    }
}

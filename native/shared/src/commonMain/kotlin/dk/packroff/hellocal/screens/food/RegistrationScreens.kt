package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.screens.capture.CaptureHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FoodDivider
import dk.packroff.hellocal.ui.FoodImage
import dk.packroff.hellocal.ui.FoodSkeleton
import dk.packroff.hellocal.ui.FoodSkeletonCards
import dk.packroff.hellocal.ui.FoodTextArea
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch

private val PAGE_PADDING = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)

/** Native port of src/app/registration/[id]/page.tsx — edit an added registration. */
@Composable
fun RegistrationScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val id = args["id"]
    var registration by remember(id) { mutableStateOf<RegistrationDto?>(null) }
    var status by remember(id) { mutableStateOf("loading") }

    LaunchedEffect(id) {
        status = try {
            val r = ApiJson.decodeFromJsonElement(RegistrationResponse.serializer(), Api.get("/api/registrations/$id")).registration
            registration = r
            if (r == null) "not_found" else "loaded"
        } catch (e: ApiException) {
            if (e.status == 404) "not_found" else "error"
        } catch (_: Exception) {
            "error"
        }
    }

    val loaded = registration
    if (status == "loaded" && loaded != null) {
        AddProductView(id = loaded.productId ?: loaded.genericIngredientId ?: "", forDish = false, registration = loaded)
        return
    }
    HcScreen(t.t("addProduct.title"), contentPadding = PaddingValues(0.dp)) {
        if (status == "loading") {
            Box(Modifier.fillMaxWidth().padding(16.dp).padding(top = 8.dp), contentAlignment = Alignment.Center) {
                FoodSkeleton(Modifier.size(190.dp), CircleShape)
            }
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                FoodSkeleton(Modifier.fillMaxWidth(0.7f).height(28.dp))
                FoodSkeleton(Modifier.fillMaxWidth().height(14.dp))
                FoodSkeleton(Modifier.fillMaxWidth(0.8f).height(14.dp))
                FoodSkeletonCards(2, 72.dp)
            }
        } else {
            HcText(
                t.t(if (status == "not_found") "registration.notFound" else "registration.loadError"),
                HcTypeRoles.Body,
                Modifier.fillMaxWidth().padding(16.dp),
                color = HcColors.TextSecondary,
                align = TextAlign.Center,
            )
        }
    }
}

/**
 * Native port of src/components/report/ReportErrorScreen.tsx
 * (/registration/[id]/report-error and /product/[id]/report-error) — pick the
 * wrong points of the product (green "!" circles) and describe each correction.
 * [byProduct]: the id is a product id ("Fejl" on search, favourites, my scans,
 * foods — every list of products has it, user 2026-10-17), not a registration id.
 */
@Composable
fun ReportErrorScreen(args: RouteArgs, byProduct: Boolean = false) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val id = args["id"]
    // undefined = loading, null = no product, list = the points.
    var loaded by remember(id) { mutableStateOf(false) }
    var points by remember(id) { mutableStateOf<List<ReportPoint>?>(null) }
    var productId by remember(id) { mutableStateOf<String?>(null) }
    var notes by remember(id) { mutableStateOf(mapOf<String, String>()) }
    // Photo from the point's own camera button (user rule 2026-10-17).
    var photos by remember(id) { mutableStateOf(mapOf<String, String>()) }
    var capturing by remember { mutableStateOf<String?>(null) }
    var captureErrors by remember(id) { mutableStateOf(mapOf<String, String>()) }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var result by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(id) {
        try {
            val pid = if (byProduct) {
                id.takeIf { it.isNotBlank() }
            } else {
                runCatching { ApiJson.decodeFromJsonElement(RegistrationResponse.serializer(), Api.get("/api/registrations/$id")).registration }.getOrNull()?.productId
            }
            if (pid != null) {
                val product = runCatching { ApiJson.decodeFromJsonElement(ProductResponse.serializer(), Api.get("/api/products/$pid")).product }.getOrNull()
                productId = pid
                points = product?.let(::reportPointsFor)
            }
        } finally {
            loaded = true
        }
    }

    val list = points
    val selected = list.orEmpty().filter { it.key in notes }
    val canSubmit = selected.isNotEmpty() && selected.all { (notes[it.key] ?: "").trim().isNotEmpty() || it.key in photos }

    // EAN uses the live scanner and writes the code into the note; the others take a photo.
    fun capture(point: ReportPoint) {
        val key = point.key
        scope.launch {
            capturing = key
            captureErrors = captureErrors - key
            try {
                if (point.capture == "barcode") {
                    val code = CaptureHooks.scanBarcode?.let { runCatching { it() }.getOrNull() }
                    if (code.isNullOrBlank()) {
                        captureErrors = captureErrors + (key to t.t("registrationReportError.barcodeUnreadable"))
                        if (key !in notes) notes = notes + (key to "")
                    } else {
                        val current = notes[key].orEmpty()
                        notes = notes + (key to current.ifBlank { t.t("registrationReportError.barcodeRead", "code" to code) })
                    }
                } else {
                    val photo = FoodPlatform.photo(fromGallery = false) ?: return@launch
                    photos = photos + (key to photo.dataUrl())
                    if (key !in notes) notes = notes + (key to "")
                }
            } catch (_: Exception) {
                captureErrors = captureErrors + (key to t.t("registrationReportError.photoFailed"))
            } finally {
                capturing = null
            }
        }
    }

    fun submit() {
        val pid = productId ?: return
        if (!canSubmit) return
        error = null
        submitting = true
        scope.launch {
            try {
                val (sections, sectionPhotos) = buildReportSections(
                    selected.map { ReportEntry(it.key, t.t(it.labelKey), notes[it.key] ?: "", photos[it.key]) },
                )
                Api.post(
                    "/api/bug-reports",
                    mapOf(
                        "productId" to pid,
                        "sections" to sections,
                        "sectionPhotos" to sectionPhotos,
                        "categories" to selected.mapNotNull { it.category }.distinct(),
                    ),
                )
                result = "sent"
            } catch (e: ApiException) {
                if (e.status == 409) result = "pending" else error = e.body.str("message") ?: t.t("registrationReportError.submitFailed")
            } catch (_: Exception) {
                error = t.t("registrationReportError.submitFailed")
            }
            submitting = false
        }
    }

    // The send button sits in the fixed footer above the bottom circle (REGLER: knapper nederst).
    val showForm = loaded && list != null && result == null
    HcScreen(
        t.t("registrationReportError.title"),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 32.dp),
        bottom = if (showForm) {
            {
                HcButton(
                    if (submitting) t.t("registrationReportError.sending") else t.t("registrationReportError.submit"),
                    onClick = ::submit,
                    enabled = canSubmit && !submitting,
                )
            }
        } else null,
    ) {
        when {
            !loaded -> HcText(t.t("common.loading"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(top = 32.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
            list == null -> Column(Modifier.fillMaxWidth().padding(top = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcText(t.t("registrationReportError.noProduct"), HcTypeRoles.Body, color = HcColors.TextSecondary, align = TextAlign.Center)
                HcButton(t.t("registrationReportError.generalReport"), onClick = { nav.push("/profile/report-bug") }, kind = HcButtonKind.Secondary)
            }
            result != null -> Column(Modifier.fillMaxWidth().padding(top = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcText(t.t(if (result == "sent") "registrationReportError.sent" else "registrationReportError.alreadyPending"), HcTypeRoles.Body, align = TextAlign.Center)
                if (result == "pending") {
                    HcButton(t.t("registrationReportError.editPending"), onClick = { nav.push("/profile/report-bug?productId=$productId") }, kind = HcButtonKind.Secondary)
                }
            }
            else -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcText(t.t("registrationReportError.intro"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                Column {
                    list.forEach { point ->
                        val isSelected = point.key in notes
                        Column(Modifier.fillMaxWidth().padding(vertical = 12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Column(Modifier.weight(1f)) {
                                    HcText(t.t(point.labelKey), HcTypeRoles.Label)
                                    if (point.imageUrl != null) {
                                        FoodImage(point.imageUrl, Modifier.padding(top = 4.dp).size(64.dp).clip(RoundedCornerShape(HcDimens.RadiusCard)), ContentScale.Crop, thumbWidth = 256)
                                    } else if (point.key != "image" || point.imageUrl == null) {
                                        HcText(point.value.ifEmpty { t.t("registrationReportError.missingValue") }, HcTypeRoles.Body, color = HcColors.TextSecondary)
                                    }
                                }
                                Box(
                                    Modifier.size(36.dp).clip(CircleShape)
                                        .background(if (isSelected) HcColors.Brand else Color.Transparent)
                                        .border(2.dp, HcColors.Brand, CircleShape)
                                        .clickable {
                                            notes = if (isSelected) notes - point.key else notes + (point.key to "")
                                            if (isSelected) photos = photos - point.key
                                        },
                                    contentAlignment = Alignment.Center,
                                ) { HcText("!", HcTypeRoles.Title, color = if (isSelected) HcColors.White else HcColors.Brand, bold = true) }
                            }
                            val capture = point.capture
                            if (capture != null) {
                                val hasPhoto = point.key in photos
                                HcButton(
                                    when {
                                        capturing == point.key -> t.t("registrationReportError.reading")
                                        hasPhoto -> t.t("registrationReportError.retake")
                                        capture == "barcode" -> t.t("registrationReportError.captureBarcode")
                                        capture == "nutrition" -> t.t("registrationReportError.captureNutrition")
                                        else -> t.t("registrationReportError.capturePhoto")
                                    },
                                    onClick = { capture(point) },
                                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                                    kind = HcButtonKind.Secondary,
                                    enabled = capturing == null,
                                    leading = { HcIcon(if (capture == "barcode") "Barcode" else "Camera", size = 20.dp, color = HcColors.Action) },
                                )
                            }
                            photos[point.key]?.let { photo ->
                                Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    FoodImage(photo, Modifier.size(64.dp).clip(RoundedCornerShape(HcDimens.RadiusCard)), ContentScale.Crop)
                                    HcText(
                                        t.t("registrationReportError.removePhoto"),
                                        HcTypeRoles.Body,
                                        Modifier.clickable { photos = photos - point.key },
                                        color = HcColors.Action,
                                    )
                                }
                            }
                            captureErrors[point.key]?.let { HcText(it, HcTypeRoles.Small, Modifier.padding(top = 4.dp), color = HcColors.RedDark) }
                            if (isSelected) {
                                FoodTextArea(
                                    value = notes[point.key] ?: "",
                                    onValueChange = { notes = notes + (point.key to it) },
                                    placeholder = t.t("registrationReportError.correctionPlaceholder"),
                                    minLines = 2,
                                    radius = 2.dp,
                                    modifier = Modifier.padding(top = 8.dp),
                                )
                            }
                        }
                        FoodDivider()
                    }
                }
                HcError(error)
            }
        }
    }
}

/**
 * Native port of src/app/add/[id]/update/page.tsx — "Opdater varen": one card
 * per missing thing; the photo is read by AI on the server and earns points.
 */
@Composable
fun ProductUpdateScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val id = args["id"]
    var kinds by remember(id) { mutableStateOf<List<String>?>(null) }
    var points by remember { mutableStateOf(20) }
    var workingKind by remember { mutableStateOf<String?>(null) }
    var outcomes by remember { mutableStateOf(mapOf<String, String>()) }
    var earned by remember { mutableStateOf(0) }

    LaunchedEffect(id) {
        kinds = try {
            val offer = ApiJson.decodeFromJsonElement(ProductResponse.serializer(), Api.get("/api/products/${encodeUri(id)}")).product?.updateOffer
            if (offer != null) points = offer.points
            offer?.kinds ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun capture(kind: String) {
        scope.launch {
            // The front is also kept in full resolution (web: fullPhoto, user rule
            // 2026-10-15); the AI gets the scaled copy.
            val takeFull = CaptureHooks.takeFullPhoto
            var fullPhoto: FoodPhoto? = null
            val photo = if (kind == "FRONT" && takeFull != null) {
                val full = runCatching { takeFull() }.getOrNull() ?: return@launch
                fullPhoto = FoodPhoto(full)
                FoodPhoto(CaptureHooks.scaleForUpload(full) ?: full)
            } else {
                FoodPlatform.photo(fromGallery = false) ?: return@launch
            }
            workingKind = kind
            try {
                val body = buildMap<String, Any> {
                    put("kind", kind)
                    put("photo", photo.dataUrl())
                    fullPhoto?.let { put("fullPhoto", it.dataUrl()) }
                    put("photoTakenAt", photo.takenAtMillis ?: FoodTime.now().toEpochMilliseconds())
                }
                val data = Api.post("/api/products/${encodeUri(id)}/update", body)
                outcomes = outcomes + (kind to if (data.bool("accepted") == true) "done" else "unreadable")
                data.num("pointsAwarded")?.let { if (it > 0) earned += it.toInt() }
            } catch (_: Exception) {
                outcomes = outcomes + (kind to "error")
            }
            workingKind = null
        }
    }

    HcScreen(t.t("productUpdate.title"), contentPadding = PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (earned > 0) HcText(t.t("productUpdate.earned", "points" to earned), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.Black, bold = true, align = TextAlign.Center)
            if (kinds != null && kinds!!.isEmpty() && earned == 0) {
                HcText(t.t("productUpdate.nothingMissing"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
            kinds.orEmpty().forEach { kind ->
                val (titleKey, hintKey) = when (kind) {
                    "FRONT" -> "productUpdate.kindFront" to "productUpdate.hintFront"
                    "NUTRITION" -> "productUpdate.kindNutrition" to "productUpdate.hintNutrition"
                    else -> "productUpdate.kindIngredients" to "productUpdate.hintIngredients"
                }
                val outcome = outcomes[kind]
                HcCard {
                    HcText(t.t(titleKey, "points" to points), HcTypeRoles.Body, color = HcColors.Black, bold = true)
                    HcText(t.t(hintKey), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    if (outcome == "done") {
                        HcText(t.t("productUpdate.done"), HcTypeRoles.Small, color = HcColors.Black, bold = true)
                    } else {
                        if (outcome == "unreadable") HcText(t.t("productUpdate.unreadable"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        if (outcome == "error") HcText(t.t("productUpdate.error"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        HcButton(
                            if (workingKind == kind) t.t("productUpdate.reading") else t.t("productUpdate.takePhoto"),
                            onClick = { capture(kind) },
                            enabled = workingKind == null,
                        )
                    }
                }
            }
            HcButton(t.t("productUpdate.back"), onClick = { nav.replace("/add/${encodeUri(id)}") }, kind = HcButtonKind.Secondary)
        }
    }
}

/**
 * Native port of src/app/add/[id]/photo-award/page.tsx — earn points by
 * sending a better photo for an open award.
 */
@Composable
fun PhotoAwardScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val id = args["id"]
    var awards by remember(id) { mutableStateOf<List<PhotoAward>>(emptyList()) }
    var submittingId by remember { mutableStateOf<String?>(null) }
    var submittedIds by remember { mutableStateOf(setOf<String>()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(id) {
        awards = runCatching { ApiJson.decodeFromJsonElement(PhotoAwardsResponse.serializer(), Api.get("/api/products/$id/photo-awards")).awards }
            .getOrDefault(emptyList())
    }

    fun capture(awardId: String) {
        scope.launch {
            val photo = FoodPlatform.photo(fromGallery = false) ?: return@launch
            submittingId = awardId
            error = null
            try {
                Api.post("/api/photo-awards/$awardId/submit", mapOf("photo" to photo.dataUrl()))
                submittedIds = submittedIds + awardId
            } catch (_: Exception) {
                error = t.t("photoAward.submitError")
            }
            submittingId = null
        }
    }

    HcScreen(t.t("photoAward.title"), contentPadding = PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            awards.forEach { award ->
                HcCard {
                    HcText(
                        t.t("photoAward.pointsForPhoto", "points" to award.points, "photoType" to t.t(photoTypeKey(award.photoType))),
                        HcTypeRoles.Body,
                        color = HcColors.Black,
                        bold = true,
                    )
                    if (award.id in submittedIds) {
                        HcText(t.t("photoAward.submitted"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    } else {
                        HcButton(
                            if (submittingId == award.id) t.t("photoAward.submitting") else t.t("photoAward.takePhoto"),
                            onClick = { capture(award.id) },
                            enabled = submittingId != award.id,
                        )
                    }
                }
            }
            error?.let { HcText(it, HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center) }
        }
    }
}

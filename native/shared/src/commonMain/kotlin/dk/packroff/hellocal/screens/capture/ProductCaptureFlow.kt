package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private enum class CaptureStep(val key: String, val icon: String) {
    Barcode("barcode", "Barcode"),
    Front("front", "Photo"),
    Nutrition("nutrition", "Flame"),
    Ingredients("ingredients", "List"),
}

/** Valid market regions (src/lib/regions.ts isRegionCode) fall back to DK like buildBarcodeContext. */
private val REGION_CODE = Regex("^[A-Z]{2}$")

/**
 * Native port of src/components/camera/ProductCaptureFlow.tsx (Tilføj → kamera,
 * docs/DECISIONS.md 2026-09-27): four step buttons — barcode, front, energy,
 * contents — the camera starts on the barcode. A known barcode goes straight
 * to the product; an unknown one leads on to front → energy → contents, and
 * once all are taken the product is created (POST /api/products/quick) and the
 * screen goes to /add/[id]. The web's live in-browser OCR/object detection has
 * no native counterpart yet, so the photos are sent without local OCR and the
 * server reads them with OpenAI (its documented fallback).
 */
@Composable
internal fun ProductCaptureFlow(returnSuffix: String) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var step by remember { mutableStateOf(CaptureStep.Barcode) }
    var done by remember { mutableStateOf(setOf<CaptureStep>()) }
    var working by remember { mutableStateOf(false) }
    var createFailed by remember { mutableStateOf(false) }
    var lookupError by remember { mutableStateOf(false) }
    var lookupBlockedMessage by remember { mutableStateOf<String?>(null) }
    var region by remember { mutableStateOf("DK") }
    var barcode by remember { mutableStateOf<String?>(null) }
    var photos by remember { mutableStateOf(mapOf<CaptureStep, String>()) }
    var lastPhoto by remember { mutableStateOf<ByteArray?>(null) }
    var status by remember { mutableStateOf(CameraStatus.Active) }

    // The user's region is the primary language signal (docs/DECISIONS.md 2026-09-12).
    LaunchedEffect(Unit) {
        runCatching {
            ((Api.get("/api/profile") as? JsonObject)?.get("user") as? JsonObject)?.get("region")?.jsonPrimitive?.contentOrNull
        }.getOrNull()?.let { region = it }
    }

    fun marketRegion() = region.uppercase().takeIf { REGION_CODE.matches(it) } ?: "DK"

    suspend fun createProduct() {
        working = true
        createFailed = false
        try {
            val body = buildMap<String, Any> {
                barcode?.let { put("barcode", it) }
                put("marketRegion", marketRegion())
                put("signals", mapOf("appLanguage" to t.locale.code))
                photos[CaptureStep.Front]?.let { put("frontPhoto", it) }
                photos[CaptureStep.Nutrition]?.let { put("nutritionPhoto", it) }
                photos[CaptureStep.Ingredients]?.let { put("ingredientsPhoto", it) }
            }
            val id = Api.post("/api/products/quick", body).jsonObject["product"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull
                ?: throw IllegalStateException("no id")
            nav.push("/add/$id$returnSuffix")
        } catch (e: Exception) {
            working = false
            createFailed = true
        }
    }

    fun goToNextStep(completed: Set<CaptureStep>) {
        val next = CaptureStep.entries.firstOrNull { it !in completed }
        if (next != null) {
            working = false
            step = next
            return
        }
        scope.launch { createProduct() }
    }

    suspend fun lookupBarcode(code: String) {
        lookupError = false
        lookupBlockedMessage = null
        working = true
        try {
            val data = Api.get("/api/products/lookup/${Location.encode(code)}").jsonObject
            val id = data["product"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull
            if (id != null) {
                nav.push("/add/$id$returnSuffix")
                return
            }
            lookupError = true
        } catch (e: ApiException) {
            val body = e.body as? JsonObject
            when {
                e.status == 422 && body?.get("code")?.jsonPrimitive?.contentOrNull == "PET_FOOD_BLOCKED" -> {
                    lookupBlockedMessage = body?.get("message")?.jsonPrimitive?.contentOrNull ?: "Dyrefoder kan ikke oprettes i Hello Cal."
                }
                e.status == 404 -> {
                    // Unknown product: keep the barcode and go on to the front.
                    barcode = code
                    done = done + CaptureStep.Barcode
                    step = CaptureStep.Front
                }
                else -> lookupError = true
            }
        } catch (e: Exception) {
            lookupError = true
        } finally {
            working = false
        }
    }

    fun capture() {
        if (working) return
        if (step == CaptureStep.Barcode) {
            if (CaptureStep.Barcode in done) return
            val scan = CaptureHooks.scanBarcode
            if (scan == null) {
                status = CameraStatus.Unavailable
                return
            }
            scope.launch {
                try {
                    val code = scan()?.filter { it.isDigit() }
                    status = CameraStatus.Active
                    if (!code.isNullOrEmpty()) lookupBarcode(code)
                } catch (e: CapturePermissionDenied) {
                    status = CameraStatus.Denied
                } catch (e: Exception) {
                    status = CameraStatus.Error
                }
            }
            return
        }
        val take = CaptureHooks.takePhoto
        if (take == null) {
            status = CameraStatus.Unavailable
            return
        }
        val current = step
        scope.launch {
            try {
                val bytes = take() ?: return@launch
                status = CameraStatus.Active
                lastPhoto = bytes
                photos = photos + (current to jpegDataUrl(bytes))
                val completed = done + current
                done = completed
                goToNextStep(completed)
            } catch (e: CapturePermissionDenied) {
                status = CameraStatus.Denied
            } catch (e: Exception) {
                status = CameraStatus.Error
            }
        }
    }

    fun selectStep(next: CaptureStep) {
        if (working || next == step) return
        // Without a barcode no other step can be read (language/region follow it).
        if (next != CaptureStep.Barcode && CaptureStep.Barcode !in done) return
        if (next == CaptureStep.Barcode && CaptureStep.Barcode in done) return
        step = next
    }

    val stepLabels = mapOf(
        CaptureStep.Barcode to t.t("cameraCreate.stepBarcode"),
        CaptureStep.Front to t.t("cameraCreate.stepFront"),
        CaptureStep.Nutrition to t.t("cameraCreate.stepNutrition"),
        CaptureStep.Ingredients to t.t("cameraCreate.stepIngredients"),
    )
    val stepHeadings = mapOf(
        CaptureStep.Barcode to t.t("cameraCreate.scanBarcode"),
        CaptureStep.Front to t.t("cameraCreate.scanFront"),
        CaptureStep.Nutrition to t.t("cameraCreate.scanNutrition"),
        CaptureStep.Ingredients to t.t("cameraCreate.scanIngredients"),
    )
    val stepHints = mapOf(
        CaptureStep.Barcode to (lookupBlockedMessage ?: if (lookupError) t.t("camera.barcodeLookupError") else t.t("camera.holdCameraStill")),
        CaptureStep.Front to t.t("cameraCreate.hintFront"),
        CaptureStep.Nutrition to t.t("cameraCreate.hintNutrition"),
        CaptureStep.Ingredients to t.t("cameraCreate.hintIngredients"),
    )
    val message = cameraMessage(status, t)

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // No "take photo" button on the web: tapping the camera area takes it.
        CameraViewport(onClick = { capture() }) {
            if (step != CaptureStep.Barcode) CapturedPhoto(lastPhoto, t.t("camera.photoAlt"))
            if (step == CaptureStep.Barcode) {
                Box(Modifier.align(Alignment.Center), contentAlignment = Alignment.Center) {
                    HcIcon("Barcode", size = 96.dp, color = HcColors.White.copy(alpha = 0.8f), stroke = 1.2f)
                }
            } else if (!working) {
                SquareGuide(0.04f)
            }
            if (working) PhotoWorkingOverlay(t.t("cameraCreate.analyzingDefault"))
            if (message != null) {
                CameraMessageOverlay(message, onClick = if (status == CameraStatus.Denied || status == CameraStatus.Error) ({ status = CameraStatus.Active }) else null)
            } else {
                HcText(
                    stepHeadings.getValue(step),
                    HcTypeRoles.Body,
                    Modifier.align(Alignment.BottomCenter).padding(16.dp),
                    bold = true,
                    color = HcColors.White,
                    align = TextAlign.Center,
                )
            }
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CaptureStep.entries.forEach { item ->
                val disabled = working || (item != CaptureStep.Barcode && CaptureStep.Barcode !in done) || (item == CaptureStep.Barcode && CaptureStep.Barcode in done)
                val shape = RoundedCornerShape(HcDimens.RadiusCard)
                val enabled = !(disabled && item != step)
                Box(
                    Modifier.weight(1f).height(64.dp).clip(shape).background(HcColors.Card, shape)
                        .let { if (item == step) it.border(2.dp, HcColors.Brand, shape) else it }
                        .alpha(if (enabled) 1f else 0.5f)
                        .clickable(enabled = enabled) { selectStep(item) },
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        HcIcon(item.icon, size = 20.dp, stroke = 1.8f, color = HcColors.Black)
                        HcText(stepLabels.getValue(item), HcTypeRoles.Micro, color = HcColors.Black, maxLines = 1)
                    }
                    if (item in done) CheckBadge(24.dp)
                }
            }
        }

        if (createFailed) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HcText(t.t("cameraCreate.createFailed"), HcTypeRoles.Small, align = TextAlign.Center)
                HcButton(t.t("cameraCreate.retry"), onClick = { scope.launch { createProduct() } })
            }
        } else {
            HcText(stepHints.getValue(step), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            if (step != CaptureStep.Barcode) {
                HcText(t.t("camera.autoCaptureHint"), HcTypeRoles.Micro, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
        }
    }
}

/**
 * Native port of src/components/camera/IngredientsRetakeFlow.tsx: a new photo
 * of the ingredients list for an existing product (docs/DECISIONS.md 2026-10-02).
 */
@Composable
internal fun IngredientsRetakeFlow(productId: String) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var photo by remember { mutableStateOf<ByteArray?>(null) }
    var working by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf("idle") }
    var status by remember { mutableStateOf(CameraStatus.Active) }
    val productHref = "/add/${Location.encode(productId)}"

    fun capturePhoto() {
        if (working) return
        val take = CaptureHooks.takePhoto
        if (take == null) {
            status = CameraStatus.Unavailable
            return
        }
        scope.launch {
            var taken: ByteArray? = null
            try {
                taken = take()
            } catch (e: CapturePermissionDenied) {
                status = CameraStatus.Denied
            } catch (e: Exception) {
                status = CameraStatus.Error
            }
            val bytes = taken ?: return@launch
            status = CameraStatus.Active
            working = true
            result = "idle"
            photo = bytes
            try {
                val data = Api.post("/api/products/${Location.encode(productId)}/ingredients-photo", mapOf("photo" to jpegDataUrl(bytes))).jsonObject
                if (data["ingredientsFound"]?.jsonPrimitive?.contentOrNull == "true") {
                    nav.replace(productHref)
                    return@launch
                }
                result = "unreadable"
            } catch (e: ApiException) {
                result = "failed"
            } catch (e: Exception) {
                result = "failed"
            }
            photo = null
            working = false
        }
    }

    val message = cameraMessage(status, t)
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        CameraViewport(onClick = { capturePhoto() }) {
            CapturedPhoto(photo, t.t("camera.photoAlt"))
            if (photo == null) SquareGuide(0.12f)
            if (message != null) {
                CameraMessageOverlay(message, onClick = if (status == CameraStatus.Denied || status == CameraStatus.Error) ({ status = CameraStatus.Active }) else null)
            }
            if (working) PhotoWorkingOverlay(t.t("cameraCreate.analyzingDefault"))
        }
        HcText(
            when (result) {
                "unreadable" -> t.t("cameraCreate.retakeStillUnreadable")
                "failed" -> t.t("cameraCreate.retakeFailed")
                else -> t.t("cameraCreate.hintIngredients")
            },
            HcTypeRoles.Small,
            Modifier.fillMaxWidth(),
            color = HcColors.TextSecondary,
            align = TextAlign.Center,
        )
        if (result == "idle") {
            HcText(t.t("camera.autoCaptureHint"), HcTypeRoles.Micro, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
        }
        HcButton(
            t.t("camera.takePhoto"),
            onClick = { capturePhoto() },
            enabled = status == CameraStatus.Active && !working,
            leading = { HcIcon("Camera", size = 19.dp, color = HcColors.White) },
        )
        HcButton(t.t("cameraCreate.retakeBack"), onClick = { nav.replace(productHref) }, kind = dk.packroff.hellocal.ui.HcButtonKind.Secondary)
    }
}

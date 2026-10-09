package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlin.math.roundToInt

private enum class CameraMode(val key: String) { Product("product"), Meal("meal"), HelloFresh("hellofresh") }

@Serializable
private data class MatchedHelloFreshProduct(
    val id: String,
    val name: String,
    val imageUrl: String? = null,
    val kcalPer100g: Double = 0.0,
    val servingSizeGrams: Double? = null,
    val servingSizeUnitSingular: String? = null,
)

@Serializable
private data class MealItem(
    val title: String,
    val amountGrams: Double = 0.0,
    val amountLabel: String = "",
    val kcal: Double = 0.0,
    val protein: Double = 0.0,
    val carbs: Double = 0.0,
    val fat: Double = 0.0,
    val productId: String? = null,
    val image: String? = null,
    val estimated: Boolean = false,
)

@Serializable
private data class MealItemsResponse(val items: List<MealItem> = emptyList())

/** Native port of src/app/camera/page.tsx. */
@Composable
fun CameraScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val modeParam = args.opt("mode")
    val forDish = args.opt("for") == "ret"
    // HelloFresh recognition only under "Opret ret" (docs/DECISIONS.md 2026-09-24).
    val mode = when {
        modeParam == "meal" -> CameraMode.Meal
        modeParam == "hellofresh" && forDish -> CameraMode.HelloFresh
        else -> CameraMode.Product
    }
    val retakeProductId = if (args.opt("retake") == "ingredients") args.opt("product") else null

    HcScreen(title = t.t("camera.title")) {
        when {
            retakeProductId != null -> IngredientsRetakeFlow(retakeProductId)
            mode == CameraMode.Product -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                if (forDish) ModeTabs(mode)
                ProductCaptureFlow(returnSuffix = if (forDish) "?for=ret" else "")
            }
            else -> PhotoModeContent(mode, forDish)
        }
    }
}

/** /camera/create redirects to the guided product flow on /camera. */
@Composable
fun CameraCreateScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val nav = LocalNavigator.current
    LaunchedEffect(Unit) { nav.replace("/camera?mode=product") }
}

/** Barcode/HelloFresh tabs — only under "Opret ret". */
@Composable
private fun ModeTabs(mode: CameraMode) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
        listOf(CameraMode.Product to "camera.tabBarcode", CameraMode.HelloFresh to "camera.tabProduct").forEach { (key, label) ->
            HcButton(
                t.t(label),
                onClick = { if (key != mode) nav.replace("/camera?mode=${key.key}&for=ret") },
                modifier = Modifier.weight(1f),
                kind = if (key == mode) HcButtonKind.Primary else HcButtonKind.Secondary,
            )
        }
    }
}

@Composable
private fun PhotoModeContent(mode: CameraMode, forDish: Boolean) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var status by remember(mode) { mutableStateOf(CameraStatus.Active) }
    var capture by remember(mode) { mutableStateOf<ByteArray?>(null) }
    var photo by remember(mode) { mutableStateOf<String?>(null) }
    var captureId by remember(mode) { mutableStateOf(0) }
    var recognizeStatus by remember(mode) { mutableStateOf("idle") }
    var matched by remember(mode) { mutableStateOf<MatchedHelloFreshProduct?>(null) }
    var mealStatus by remember(mode) { mutableStateOf("idle") }
    var mealItems by remember(mode) { mutableStateOf<List<Pair<Int, MealItem>>>(emptyList()) }
    var mealSaving by remember(mode) { mutableStateOf(false) }

    fun restartCamera() {
        captureId++
        capture = null
        photo = null
        status = CameraStatus.Active
        recognizeStatus = "idle"
        matched = null
        mealStatus = "idle"
        mealItems = emptyList()
    }

    fun capturePhoto() {
        val take = CaptureHooks.takePhoto
        if (take == null) {
            status = CameraStatus.Unavailable
            return
        }
        scope.launch {
            try {
                val bytes = take() ?: return@launch
                status = CameraStatus.Active
                captureId++
                capture = bytes
                // The web lets the user pick one of several detected objects; natively the whole photo is used.
                photo = jpegDataUrl(bytes)
            } catch (e: CapturePermissionDenied) {
                status = CameraStatus.Denied
            } catch (e: Exception) {
                status = CameraStatus.Error
            }
        }
    }

    LaunchedEffect(photo, captureId) {
        val current = photo ?: return@LaunchedEffect
        if (mode == CameraMode.HelloFresh) {
            val body: JsonElement? = try {
                Api.post("/api/ai/recognize-hellofresh", mapOf("photo" to current))
            } catch (e: ApiException) {
                e.body ?: JsonNull
            } catch (e: Exception) {
                null
            }
            if (body == null || body == JsonNull) {
                recognizeStatus = "failed"
                return@LaunchedEffect
            }
            val product = (body as? JsonObject)?.get("product")?.takeIf { it is JsonObject }
                ?.let { runCatching { ApiJson.decodeFromJsonElement(MatchedHelloFreshProduct.serializer(), it) }.getOrNull() }
            matched = product
            recognizeStatus = if (product != null) "found" else "not_found"
        } else {
            val body: JsonElement? = try {
                Api.post("/api/ai/analyze-meal-photo", mapOf("photo" to current))
            } catch (e: ApiException) {
                e.body
            } catch (e: Exception) {
                null
            }
            val parsed = body?.let { runCatching { ApiJson.decodeFromJsonElement(MealItemsResponse.serializer(), it) }.getOrNull() }
            if (parsed == null) {
                mealStatus = "error"
            } else {
                mealItems = parsed.items.mapIndexed { index, item -> index to item }
                mealStatus = "done"
            }
        }
    }

    // Not recognised: back to the camera after 1.8 s.
    LaunchedEffect(recognizeStatus) {
        if (recognizeStatus != "not_found") return@LaunchedEffect
        delay(1800)
        restartCamera()
    }

    fun saveMeal() {
        if (mealSaving || mealItems.isEmpty()) return
        mealSaving = true
        scope.launch {
            try {
                coroutineScope {
                mealItems.map { (_, item) ->
                    async {
                        val body = buildMap<String, Any> {
                            if (item.productId != null) {
                                put("productId", item.productId)
                                put("amountGrams", item.amountGrams)
                            } else {
                                put("amountGrams", item.amountGrams)
                                put("titleSnapshot", item.title)
                                put("kcalSnapshot", item.kcal)
                                put("proteinSnapshot", item.protein)
                                put("carbsSnapshot", item.carbs)
                                put("fatSnapshot", item.fat)
                            }
                            // Shared meal (docs/FAMILY.md).
                            putAll(MealShare.body())
                        }
                        Api.post("/api/registrations", body)
                    }
                }.awaitAll()
                }
                NativeHooks.onRegistrationChanged()
                nav.push("/")
            } catch (e: Exception) {
                mealSaving = false
            }
        }
    }

    val message = cameraMessage(status, t)

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (mode == CameraMode.HelloFresh && forDish) ModeTabs(mode)

        CameraViewport(onClick = if (capture == null && status == CameraStatus.Active) ({ capturePhoto() }) else null) {
            CapturedPhoto(capture, t.t("camera.photoAlt"))
            if (capture == null) CircleGuide()
            if (message != null) {
                CameraMessageOverlay(message, onClick = if (status == CameraStatus.Denied || status == CameraStatus.Error) ({ restartCamera() }) else null)
            }
            if (status == CameraStatus.Active && capture == null) {
                CameraTopHint(if (mode == CameraMode.HelloFresh) t.t("camera.placeProductInCircle") else t.t("camera.placePlateInCircle"))
            }
            if (mode == CameraMode.HelloFresh && recognizeStatus == "not_found") {
                CameraMessageOverlay(t.t("camera.notRecognizedRetry"), onClick = { restartCamera() })
            }
        }

        if (mode == CameraMode.HelloFresh) {
            if (capture != null) {
                if (recognizeStatus != "not_found") {
                    HelloFreshMatchReview(
                        status = if (recognizeStatus == "idle") "processing" else recognizeStatus,
                        product = matched,
                        onConfirm = { matched?.let { nav.push("/add/${it.id}") } },
                        onRetake = { restartCamera() },
                    )
                }
            } else {
                Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = Alignment.Center) {
                    HcButton(
                        t.t("camera.takePhotoOfProduct"),
                        onClick = { capturePhoto() },
                        modifier = Modifier.widthIn(max = 320.dp),
                        enabled = status == CameraStatus.Active,
                        leading = { HcIcon("Camera", size = 19.dp, color = HcColors.White) },
                    )
                }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = Alignment.Center) {
                    if (capture != null) {
                        HcButton(t.t("camera.retakePhoto"), onClick = { restartCamera() }, modifier = Modifier.widthIn(max = 320.dp), kind = HcButtonKind.Secondary)
                    } else {
                        HcButton(
                            t.t("camera.takePhoto"),
                            onClick = { capturePhoto() },
                            modifier = Modifier.widthIn(max = 320.dp),
                            enabled = status == CameraStatus.Active,
                            leading = { HcIcon("Camera", size = 19.dp, color = HcColors.White) },
                        )
                    }
                }
                if (capture != null && mealStatus == "idle") {
                    HcText(t.t("camera.analyzingMeal"), HcTypeRoles.Small, Modifier.fillMaxWidth(), bold = true, color = HcColors.TextSecondary, align = TextAlign.Center)
                }
                if (photo != null && mealStatus == "error") {
                    HcText(t.t("camera.mealAnalyzeError"), HcTypeRoles.Small, Modifier.fillMaxWidth(), bold = true, color = HcColors.RedDark, align = TextAlign.Center)
                }
                if (photo != null && mealStatus == "done" && mealItems.isEmpty()) {
                    HcText(t.t("camera.noMealItemsFound"), HcTypeRoles.Small, Modifier.fillMaxWidth(), bold = true, color = HcColors.TextSecondary, align = TextAlign.Center)
                }
                if (photo != null && mealStatus == "done" && mealItems.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        mealItems.forEach { (id, item) ->
                            MealItemRow(item, onRemove = { mealItems = mealItems.filter { it.first != id } })
                        }
                    }
                    HcButton(if (mealSaving) t.t("camera.savingMeal") else t.t("camera.saveMeal"), onClick = { saveMeal() }, enabled = !mealSaving)
                }
            }
        }
    }
}

@Composable
private fun MealItemRow(item: MealItem, onRemove: () -> Unit) {
    val t = LocalTranslator.current
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                HcText(item.title, HcTypeRoles.Body, Modifier.weight(1f, fill = false), bold = true, color = HcColors.Black, maxLines = 1)
                if (item.estimated) {
                    Box(Modifier.clip(RoundedCornerShape(50)).background(HcColors.White).alpha(0.7f).padding(horizontal = 6.dp, vertical = 2.dp)) {
                        HcText(t.t("camera.aiEstimateBadge").uppercase(), HcTypeRoles.Micro, bold = true, color = HcColors.Black)
                    }
                }
            }
            HcText("${item.amountLabel} · ${item.kcal.roundToInt()} kcal", HcTypeRoles.Small, color = HcColors.TextSecondary)
        }
        HcText(t.t("camera.removeItem"), HcTypeRoles.Body, Modifier.clickable(onClick = onRemove), bold = true, underline = true, color = HcColors.TextSecondary)
    }
}

/** src/components/HelloFreshMatchReview.tsx (Danish texts are hard-coded on the web too). */
@Composable
private fun HelloFreshMatchReview(status: String, product: MatchedHelloFreshProduct?, onConfirm: () -> Unit, onRetake: () -> Unit) {
    HcCard {
        when {
            status == "processing" -> HcText("Genkender retten...", HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), color = HcColors.TextSecondary)
            status == "found" && product != null -> Row(
                Modifier.padding(bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(Modifier.size(48.dp).clip(RoundedCornerShape(12.dp)).background(HcColors.White.copy(alpha = 0.4f))) {
                    if (product.imageUrl != null) HcRemoteImage(product.imageUrl, Modifier.size(48.dp), contentScale = ContentScale.Crop)
                }
                Column(Modifier.weight(1f)) {
                    HcText(product.name, HcTypeRoles.Body, bold = true, color = HcColors.Black, maxLines = 1)
                    val serving = product.servingSizeGrams
                    val unit = product.servingSizeUnitSingular
                    HcText(
                        if (serving != null && serving > 0 && !unit.isNullOrEmpty()) "${(product.kcalPer100g * serving / 100).roundToInt()} kcal / $unit"
                        else "${product.kcalPer100g.roundToInt()} kcal/100g",
                        HcTypeRoles.Small,
                        color = HcColors.TextSecondary,
                    )
                }
            }
            status == "not_found" -> HcText(
                "Kunne ikke genkende retten. Prøv et andet billede, eller søg den manuelt under Madvarer.",
                HcTypeRoles.Small,
                Modifier.padding(bottom = 8.dp),
                bold = true,
                color = HcColors.Black,
            )
            status == "failed" -> HcText("Genkendelsen slog fejl. Prøv igen.", HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), bold = true, color = HcColors.Black)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HcButton("Tag billedet om", onClick = onRetake, modifier = Modifier.weight(1f), kind = HcButtonKind.Secondary)
            if (status == "found") HcButton("Er det denne ret?", onClick = onConfirm, modifier = Modifier.weight(1f))
        }
    }
}

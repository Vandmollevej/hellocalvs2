package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FoodImage
import dk.packroff.hellocal.ui.FoodOutlinedCard
import dk.packroff.hellocal.ui.FoodTextArea
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcLink
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.coroutines.launch

/**
 * src/lib/product-draft.ts — what the guided camera flow (/camera/create) already
 * photographed and recognised; /product/create pre-fills from it and clears it.
 * TODO(parity): the camera area sets [ProductDraftStore.draft] before navigating here.
 */
data class ProductCreateDraft(
    val brand: String? = null,
    val subbrand: String? = null,
    val name: String? = null,
    val variant: String? = null,
    val packageSizeText: String? = null,
    val kcalPer100g: String? = null,
    val proteinPer100g: String? = null,
    val carbsPer100g: String? = null,
    val fatPer100g: String? = null,
    val servingSizeGrams: String? = null,
    val ingredientsText: String? = null,
    val verifiedBarcode: Boolean = false,
    val verifiedNutrition: Boolean = false,
    val verifiedIngredients: Boolean = false,
    val alternativeServings: JsonElement? = null,
    val barcodeValue: String? = null,
    val barcodeImage: String? = null,
    val nutritionImage: String? = null,
    val ingredientsImage: String? = null,
    val mainImage: String? = null,
    val sideImages: List<String?> = listOf(null, null, null),
    val marketRegion: String? = null,
    val gs1Regions: List<String> = emptyList(),
    val analysisIds: JsonElement? = null,
)

object ProductDraftStore {
    var draft: ProductCreateDraft? = null

    /** readDraft(): the draft is consumed once. */
    fun take(): ProductCreateDraft = (draft ?: ProductCreateDraft()).also { draft = null }
}

private data class ProductForm(
    val brand: String = "",
    val subbrand: String = "",
    val name: String = "",
    val variant: String = "",
    val packageSizeText: String = "",
    val kcal: String = "",
    val protein: String = "",
    val carbs: String = "",
    val fat: String = "",
    val servingSizeGrams: String = "",
    val unitSingular: String = "",
    val unitPlural: String = "",
    val ingredientsText: String = "",
)

private data class ProductMedia(
    val barcodeImage: String? = null,
    val barcodeValue: String = "",
    val nutritionImage: String? = null,
    val ingredientsImage: String? = null,
    val mainImage: String? = null,
    val sideImages: List<String?> = listOf(null, null, null),
)

private val OCR_LANGUAGE_BY_REGION = mapOf(
    "DK" to "dan+eng", "SE" to "swe+eng", "NO" to "nor+eng", "DE" to "deu+eng", "AT" to "deu+eng", "CH" to "deu+eng",
    "NL" to "nld+eng", "BE" to "nld+eng", "FR" to "fra+eng", "IT" to "ita+eng", "ES" to "spa+eng", "GB" to "eng",
    "IE" to "eng", "US" to "eng", "CA" to "eng+fra", "AU" to "eng", "NZ" to "eng",
)

private fun regionToOcrLanguage(region: String) = OCR_LANGUAGE_BY_REGION[region] ?: "dan+eng"

private fun hasMeaningfulText(text: String) = text.count { it.isLetterOrDigit() } >= 4

private val INGREDIENTS_HEADING = Regex("(?:ingredienser|ingredients|ingrediensar|zutaten|ingrédients|ingrediënten|ingredienti|ingredientes|ainesosat|składniki)\\s*:?", RegexOption.IGNORE_CASE)
private val INGREDIENTS_END = Regex("(?:næringsindhold|næringsdeklaration|næringsværdi|nutrition|näringsvärde|n[äåa]hrwert|durchschnittliche|brennwert|valeurs nutritionnelles|voedingswaarde|valori nutrizionali|informaci[óo]n nutricional)", RegexOption.IGNORE_CASE)

/** src/lib/product-ocr.ts findIngredientsSection — the list after "Ingredienser:" on a nutrition photo. */
private fun findIngredientsSection(rawText: String): String? {
    val text = rawText.replace(Regex("\\s+"), " ")
    val heading = INGREDIENTS_HEADING.find(text) ?: return null
    var section = text.substring(heading.range.last + 1)
    INGREDIENTS_END.find(section)?.let { section = section.substring(0, it.range.first) }
    section = section.trim().replace(Regex("\\.(?:\\s+\\S{1,2}){1,3}$"), ".")
    return if (section.count { it.isLetter() } >= 12) section else null
}

private enum class BoxStatus { Idle, Working, Failed, Done }

/** Native port of src/app/product/create/page.tsx — create a product from the scanned photos. */
@Composable
fun ProductCreateScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val fromFailedAdd = args.opt("fromFailedAdd") == "1"
    val initial = remember { ProductDraftStore.take() }
    var form by remember {
        mutableStateOf(
            ProductForm(
                brand = initial.brand ?: "", subbrand = initial.subbrand ?: "", name = initial.name ?: "", variant = initial.variant ?: "",
                packageSizeText = initial.packageSizeText ?: "", kcal = initial.kcalPer100g ?: "", protein = initial.proteinPer100g ?: "",
                carbs = initial.carbsPer100g ?: "", fat = initial.fatPer100g ?: "", servingSizeGrams = initial.servingSizeGrams ?: "",
                ingredientsText = initial.ingredientsText ?: "",
            ),
        )
    }
    var media by remember {
        mutableStateOf(
            ProductMedia(
                initial.barcodeImage, initial.barcodeValue ?: "", initial.nutritionImage, initial.ingredientsImage, initial.mainImage,
                initial.sideImages.let { (it + listOf(null, null, null)).take(3) },
            ),
        )
    }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var savedOffline by remember { mutableStateOf(false) }
    var region by remember { mutableStateOf(initial.marketRegion ?: "DK") }
    var barcodeStatus by remember { mutableStateOf(if (initial.verifiedBarcode && initial.barcodeImage != null) BoxStatus.Done else BoxStatus.Idle) }
    var nutritionStatus by remember { mutableStateOf(if (initial.verifiedNutrition && initial.nutritionImage != null) BoxStatus.Done else BoxStatus.Idle) }
    var ingredientsStatus by remember { mutableStateOf(if (initial.verifiedIngredients && initial.ingredientsImage != null) BoxStatus.Done else BoxStatus.Idle) }
    val uiLang = if (t.locale == Locale.Da) "da" else "en"

    LaunchedEffect(Unit) {
        if (initial.marketRegion != null) return@LaunchedEffect
        FoodProfile.refresh()?.region?.let { region = it }
    }

    // Local OCR text → ingredients field; AI only translates to the UI language.
    suspend fun applyIngredientsText(text: String, ocrLang: String): Boolean {
        val cleaned = text.replace(Regex("\\s+"), " ").trim()
        val primary = ocrLang.split("+").first()
        if ((primary == "dan" && uiLang == "da") || (primary == "eng" && uiLang == "en")) {
            form = form.copy(ingredientsText = cleaned)
            return true
        }
        val translated = runCatching { Api.post("/api/ai/extract-ingredients", mapOf("text" to cleaned, "targetLang" to uiLang)).str("text") }.getOrNull()
        form = form.copy(ingredientsText = translated ?: cleaned)
        return translated != null
    }

    fun pickBarcode() = scope.launch {
        val photo = FoodPlatform.photo(fromGallery = false) ?: return@launch
        barcodeStatus = BoxStatus.Working
        val code = runCatching { FoodPlatform.decodeBarcode?.invoke(photo) }.getOrNull()
        // No AI fallback on purpose: the user corrects the field below.
        barcodeStatus = if (code != null) BoxStatus.Done else BoxStatus.Failed
        media = media.copy(barcodeImage = photo.dataUrl(), barcodeValue = code ?: media.barcodeValue)
    }

    fun pickNutrition() = scope.launch {
        val photo = FoodPlatform.photo(fromGallery = false) ?: return@launch
        val dataUrl = photo.dataUrl()
        nutritionStatus = BoxStatus.Working
        var ingredientsImage = media.ingredientsImage
        try {
            val ocrLang = regionToOcrLanguage(region)
            val ocrText = runCatching { FoodPlatform.recognizeText?.invoke(photo, ocrLang)?.first }.getOrNull()
            // Ingredients next to the nutrition table: that box is done by the same photo.
            ocrText?.let(::findIngredientsSection)?.let { section ->
                val previous = ingredientsStatus
                ingredientsStatus = BoxStatus.Working
                val ok = runCatching { applyIngredientsText(section, ocrLang) }.getOrDefault(false)
                if (ok) ingredientsImage = dataUrl
                ingredientsStatus = if (ok) BoxStatus.Done else previous
            }
            val values = Api.post("/api/ai/extract-nutrition", mapOf("photo" to dataUrl)).obj("values")
            val kcal = values.num("kcalPer100g")
            val protein = values.num("proteinPer100g")
            val carbs = values.num("carbsPer100g")
            val fat = values.num("fatPer100g")
            if (kcal != null && protein != null && carbs != null && fat != null) {
                form = form.copy(kcal = jsNumberText(kcal), protein = jsNumberText(protein), carbs = jsNumberText(carbs), fat = jsNumberText(fat))
                nutritionStatus = BoxStatus.Done
            } else {
                nutritionStatus = BoxStatus.Failed
            }
        } catch (_: Exception) {
            nutritionStatus = BoxStatus.Failed
        }
        media = media.copy(nutritionImage = dataUrl, ingredientsImage = ingredientsImage)
    }

    fun pickIngredients() = scope.launch {
        val photo = FoodPlatform.photo(fromGallery = false) ?: return@launch
        ingredientsStatus = BoxStatus.Working
        try {
            val ocrLang = regionToOcrLanguage(region)
            val ocrText = FoodPlatform.recognizeText?.invoke(photo, ocrLang)?.first
            ingredientsStatus = if (ocrText != null && hasMeaningfulText(ocrText) && applyIngredientsText(ocrText, ocrLang)) BoxStatus.Done else BoxStatus.Failed
        } catch (_: Exception) {
            ingredientsStatus = BoxStatus.Failed
        }
        media = media.copy(ingredientsImage = photo.dataUrl())
    }

    fun pickImage(slot: Int) = scope.launch {
        val photo = FoodPlatform.photo(fromGallery = false) ?: return@launch
        media = if (slot == 0) media.copy(mainImage = photo.dataUrl())
        else media.copy(sideImages = media.sideImages.mapIndexed { i, v -> if (i == slot - 1) photo.dataUrl() else v })
    }

    fun submit() {
        saving = true
        saveError = null
        val body: JsonObject = buildJsonObject {
            fun opt(key: String, value: String) { if (value.isNotEmpty()) put(key, value) }
            opt("brand", form.brand)
            opt("subbrand", form.subbrand)
            put("name", form.name)
            opt("variant", form.variant)
            opt("packageSizeText", form.packageSizeText)
            put("kcalPer100g", form.kcal)
            put("proteinPer100g", form.protein)
            put("carbsPer100g", form.carbs)
            put("fatPer100g", form.fat)
            opt("servingSizeGrams", form.servingSizeGrams)
            opt("servingSizeUnitSingular", form.unitSingular)
            opt("servingSizeUnitPlural", form.unitPlural)
            opt("ingredientsText", form.ingredientsText)
            opt("barcode", media.barcodeValue)
            media.mainImage?.let { put("imageUrl", it) }
            put("extraImages", buildJsonArray { media.sideImages.filterNotNull().forEach { add(JsonPrimitive(it)) } })
            put("analysisIds", initial.analysisIds ?: JsonObject(emptyMap()))
            put("marketRegion", region)
            put("gs1Regions", buildJsonArray { initial.gs1Regions.forEach { add(JsonPrimitive(it)) } })
            put("alternativeServings", initial.alternativeServings ?: buildJsonArray { })
        }
        scope.launch {
            try {
                val data = Api.post("/api/products", body)
                val id = data.obj("product").str("id")
                if (id != null) nav.push("/add/$id")
            } catch (e: ApiException) {
                saveError = e.body.str("message") ?: t.t("productCreate.saveError")
            } catch (_: Exception) {
                // A real network failure: queue it on the device instead of a dead-end error.
                OfflineProductQueue.queue(body)
                savedOffline = true
            }
            saving = false
        }
    }

    if (savedOffline) {
        HcScreen(t.t("productCreate.title"), contentPadding = LIST_PAGE_PADDING) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcText(
                    t.t("productCreate.savedOffline"),
                    HcTypeRoles.Body,
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Brand).padding(16.dp),
                    color = HcColors.White,
                    align = TextAlign.Center,
                )
                HcButton(t.t("common.continue"), onClick = { nav.push("/foods") })
            }
        }
        return
    }

    HcScreen(t.t("productCreate.title"), contentPadding = LIST_PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (fromFailedAdd) {
                HcText(
                    t.t("productCreate.failedAddBanner"),
                    HcTypeRoles.Body,
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Brand).padding(16.dp),
                    color = HcColors.White,
                    align = TextAlign.Center,
                )
                Column {
                    FoodOutlinedCard(borderColor = HcColors.Brand) {
                        HcText(t.t("productCreate.pointsBanner"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.Text, align = TextAlign.Center)
                    }
                    Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.Center) {
                        HcText("*", HcTypeRoles.Caption)
                        HcLink(t.t("productCreate.readTerms"), "/betingelser#pointsystem", role = HcTypeRoles.Caption)
                    }
                }
            }

            // design.md §6.11 — the 2×2 media grid.
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                MediaBox(1, t.t("productCreate.mediaBarcode"), media.barcodeImage, { FoodImage("/icons/barcode/barcode-card.png", Modifier.size(64.dp, 44.dp)) },
                    barcodeStatus, t.t("productCreate.mediaScanningBarcode"), t.t("productCreate.mediaScanFailedBarcode"),
                    t.t("productCreate.mediaVerified", "box" to t.t("productCreate.mediaBarcode")), Modifier.weight(1f)) { pickBarcode() }
                MediaBox(2, t.t("productCreate.mediaNutrition"), media.nutritionImage, { HcIcon("ClipboardText", size = 32.dp, stroke = 1.75f) },
                    nutritionStatus, t.t("productCreate.mediaScanningNutrition"), t.t("productCreate.mediaScanFailedNutrition"),
                    t.t("productCreate.mediaVerified", "box" to t.t("productCreate.mediaNutrition")), Modifier.weight(1f)) { pickNutrition() }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                MediaBox(3, t.t("productCreate.mediaIngredients"), media.ingredientsImage, { HcIcon("List", size = 32.dp, stroke = 1.75f) },
                    ingredientsStatus, t.t("productCreate.mediaScanningIngredients"), t.t("productCreate.mediaScanFailedIngredients"),
                    t.t("productCreate.mediaVerified", "box" to t.t("productCreate.mediaIngredients")), Modifier.weight(1f)) { pickIngredients() }
                Box(Modifier.weight(1f).aspectRatio(1f)) {
                    Column(
                        Modifier.fillMaxSize().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Card).padding(6.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        val images = listOf(media.mainImage) + media.sideImages
                        images.chunked(2).forEachIndexed { rowIndex, row ->
                            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                row.forEachIndexed { i, image ->
                                    val slot = rowIndex * 2 + i
                                    Box(
                                        Modifier.weight(1f).fillMaxSize().clip(RoundedCornerShape(6.dp)).background(HcColors.Surface).clickable { pickImage(slot) },
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        if (image != null) FoodImage(image, Modifier.fillMaxSize(), ContentScale.Crop)
                                        else HcIcon("Photo", size = 18.dp, color = HcColors.Inactive, stroke = 1.75f)
                                    }
                                }
                            }
                        }
                    }
                    NumberedBadge(4)
                }
            }

            HcTextField(
                value = media.barcodeValue,
                onValueChange = { media = media.copy(barcodeValue = it) },
                label = t.t("productCreate.barcodeLabel"),
                placeholder = t.t("productCreate.barcodePlaceholder"),
                keyboardType = KeyboardType.Number,
                standard = true,
            )

            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Card).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                HcTextField(form.brand, { form = form.copy(brand = it) }, label = t.t("productCreate.brandLabel"), placeholder = t.t("productCreate.brandPlaceholder"), standard = true)
                HcTextField(form.subbrand, { form = form.copy(subbrand = it) }, label = t.t("productCreate.subbrandLabel"), placeholder = t.t("productCreate.subbrandPlaceholder"), standard = true)
                HcTextField(form.name, { form = form.copy(name = it) }, label = t.t("productCreate.productNameLabel"), placeholder = t.t("productCreate.productNamePlaceholder"), standard = true)
                HcTextField(form.variant, { form = form.copy(variant = it) }, label = t.t("productCreate.variantLabel"), placeholder = t.t("productCreate.variantPlaceholder"), standard = true)
                HcTextField(form.packageSizeText, { form = form.copy(packageSizeText = it) }, label = t.t("productCreate.packageSizeLabel"), placeholder = t.t("productCreate.packageSizePlaceholder"), standard = true)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    HcTextField(form.kcal, { form = form.copy(kcal = it) }, Modifier.weight(1f), label = t.t("productCreate.caloriesLabel"), keyboardType = KeyboardType.Decimal, standard = true)
                    HcTextField(form.protein, { form = form.copy(protein = it) }, Modifier.weight(1f), label = t.t("productCreate.proteinLabel"), keyboardType = KeyboardType.Decimal, standard = true)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    HcTextField(form.carbs, { form = form.copy(carbs = it) }, Modifier.weight(1f), label = t.t("productCreate.carbsLabel"), keyboardType = KeyboardType.Decimal, standard = true)
                    HcTextField(form.fat, { form = form.copy(fat = it) }, Modifier.weight(1f), label = t.t("productCreate.fatLabel"), keyboardType = KeyboardType.Decimal, standard = true)
                }
                HcTextField(form.servingSizeGrams, { form = form.copy(servingSizeGrams = it) }, label = t.t("productCreate.servingSizeLabel"), keyboardType = KeyboardType.Decimal, standard = true)
                if (form.servingSizeGrams.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        HcTextField(form.unitSingular, { form = form.copy(unitSingular = it) }, Modifier.weight(1f), label = t.t("productCreate.servingSizeUnitSingularLabel"), placeholder = t.t("productCreate.servingSizeUnitSingularPlaceholder"), standard = true)
                        HcTextField(form.unitPlural, { form = form.copy(unitPlural = it) }, Modifier.weight(1f), label = t.t("productCreate.servingSizeUnitPluralLabel"), placeholder = t.t("productCreate.servingSizeUnitPluralPlaceholder"), standard = true)
                    }
                }
                FoodTextArea(form.ingredientsText, { form = form.copy(ingredientsText = it) }, label = t.t("productCreate.ingredientsLabel"), minLines = 3)
            }

            saveError?.let { HcText(it, HcTypeRoles.Caption, Modifier.fillMaxWidth(), align = TextAlign.Center) }
            val required = form.name.isNotBlank() && form.kcal.isNotBlank() && form.protein.isNotBlank() && form.carbs.isNotBlank() && form.fat.isNotBlank()
            HcButton(if (saving) t.t("productCreate.saving") else t.t("productCreate.createProduct"), onClick = ::submit, enabled = !saving && required)
        }
    }
}

/** NumberedBadge.tsx — brand circle with the box number, -8 px outside the corner. */
@Composable
private fun NumberedBadge(number: Int) {
    Box(Modifier.offset((-8).dp, (-8).dp).size(28.dp).clip(CircleShape).background(HcColors.Brand), contentAlignment = Alignment.Center) {
        HcText(number.toString(), HcTypeRoles.Button, color = HcColors.White)
    }
}

/** CreateProductMediaGrid MediaBox: photo box with working / failed / verified overlays. */
@Composable
private fun MediaBox(
    number: Int,
    label: String,
    image: String?,
    icon: @Composable () -> Unit,
    status: BoxStatus,
    workingLabel: String,
    failedLabel: String,
    doneLabel: String,
    modifier: Modifier,
    onPick: () -> Unit,
) {
    Box(modifier.aspectRatio(1f)) {
        Box(Modifier.fillMaxSize().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Card).clickable(onClick = onPick), contentAlignment = Alignment.Center) {
            if (image != null) {
                FoodImage(image, Modifier.fillMaxSize(), ContentScale.Crop, contentDescription = label)
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    icon()
                    HcText(label, HcTypeRoles.Caption, Modifier.padding(horizontal = 8.dp), align = TextAlign.Center)
                }
            }
            when (status) {
                BoxStatus.Working -> Box(Modifier.fillMaxSize().background(HcColors.Black.copy(alpha = 0.55f)).padding(8.dp), contentAlignment = Alignment.Center) {
                    HcText(workingLabel, HcTypeRoles.Caption, color = HcColors.White, align = TextAlign.Center)
                }
                BoxStatus.Done -> Box(Modifier.fillMaxSize().background(HcColors.Black.copy(alpha = 0.35f)), contentAlignment = Alignment.Center) {
                    Box(Modifier.size(36.dp).clip(CircleShape).background(HcColors.Positive), contentAlignment = Alignment.Center) {
                        HcIcon("Check", size = 22.dp, color = HcColors.White, stroke = 3f, contentDescription = doneLabel)
                    }
                }
                BoxStatus.Failed -> Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(HcColors.Black.copy(alpha = 0.6f)).padding(horizontal = 6.dp, vertical = 4.dp)) {
                    HcText(failedLabel, HcTypeRoles.Caption, Modifier.fillMaxWidth(), color = HcColors.White, align = TextAlign.Center)
                }
                BoxStatus.Idle -> Unit
            }
        }
        NumberedBadge(number)
    }
}

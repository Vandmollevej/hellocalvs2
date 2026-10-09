package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import coil3.compose.AsyncImagePainter
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
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.FoodFavoriteIcon
import dk.packroff.hellocal.ui.FoodImage
import dk.packroff.hellocal.ui.FoodMacroSliderBar
import dk.packroff.hellocal.ui.FoodOutlinedCard
import dk.packroff.hellocal.ui.FoodPillButton
import dk.packroff.hellocal.ui.FoodSkeleton
import dk.packroff.hellocal.ui.FoodUncertaintyTilde
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val PENDING_POLL_MS = 2500L
private const val CUTOUT_WAIT_MS = 3 * 60 * 1000L

/** Native port of src/app/add/[id]/page.tsx. */
@Composable
fun AddProductScreen(args: RouteArgs) {
    AddProductView(
        id = args["id"],
        forDish = args.opt("for") == "ret",
        initialTime = args.opt("time"),
        initialDate = args.opt("date"),
    )
}

private sealed interface LoadState {
    data object Loading : LoadState
    data class Loaded(val product: ProductDto) : LoadState
    data object NotFound : LoadState
    data object Failed : LoadState
}

private data class MacroValues(val amount: Double, val protein: Double, val carbs: Double, val fat: Double)

private data class NutrientRow(
    val key: String,
    val value: Double,
    val unit: String,
    val digits: Int,
    val estimated: Boolean,
    val tolerance: Double?,
    val label: String,
)

/** Snapshot semantics (docs/DATABASE.md): an edited registration uses its own per-100 g values. */
private fun applyRegistrationSnapshot(product: ProductDto, registration: RegistrationDto?): ProductDto {
    if (registration == null || registration.amountGrams <= 0) return product
    fun per100(v: Double) = v / registration.amountGrams * 100
    return product.copy(
        kcalPer100g = per100(registration.kcalSnapshot),
        proteinPer100g = per100(registration.proteinSnapshot),
        carbsPer100g = per100(registration.carbsSnapshot),
        fatPer100g = per100(registration.fatSnapshot),
    )
}

private fun productFromRegistration(registration: RegistrationDto): ProductDto =
    applyRegistrationSnapshot(ProductDto(id = "", name = registration.titleSnapshot, isGenericIngredient = true), registration)

/**
 * src/components/add/AddProductView.tsx — "Tilføj produkt": amount, time,
 * energy split and nutrition. With [registration] an existing registration is
 * edited (/registration/[id]); id is then the product's id or "" for an own dish.
 */
@Composable
fun AddProductView(
    id: String,
    forDish: Boolean,
    initialTime: String? = null,
    initialDate: String? = null,
    registration: RegistrationDto? = null,
) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current.density
    val isEditing = registration != null
    var state by remember(id, registration) {
        mutableStateOf<LoadState>(if (id.isEmpty() && registration != null) LoadState.Loaded(productFromRegistration(registration)) else LoadState.Loading)
    }
    var profile by remember { mutableStateOf<FoodProfileUser?>(null) }
    var amount by remember { mutableStateOf(registration?.amountGrams ?: 100.0) }
    var amountTouched by remember { mutableStateOf(false) }
    fun setAmount(value: Double) {
        amountTouched = true
        amount = value
    }
    var amountUnit by remember { mutableStateOf("gram") }
    val time = remember { registration?.let { FoodTime.hhmm(it.createdAt) } ?: initialTime ?: FoodTime.currentTimeString() }
    val date = remember {
        registration?.let { r -> FoodTime.parse(r.createdAt)?.let { FoodTime.dateString(it) } } ?: initialDate ?: FoodTime.currentDateString()
    }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var openAdditive by remember { mutableStateOf<String?>(null) }
    var extendedToggle by remember { mutableStateOf<Boolean?>(null) }
    var imageLandscape by remember { mutableStateOf(false) }
    var toxinsOpen by remember { mutableStateOf(false) }
    var openToxin by remember { mutableStateOf<ToxinInfo?>(null) }
    var openMicronutrient by remember { mutableStateOf<String?>(null) }
    var uncertaintyToggled by remember { mutableStateOf(setOf<String>()) }
    var additiveNames by remember { mutableStateOf(mapOf<String, String>()) }
    var isFavorite by remember { mutableStateOf(false) }
    var favoritePending by remember { mutableStateOf(false) }
    var photoAwards by remember { mutableStateOf<List<PhotoAward>>(emptyList()) }
    var macroOverride by remember { mutableStateOf<MacroValues?>(null) }
    var unlocked by remember { mutableStateOf(false) }
    var overrideSnapshot by remember { mutableStateOf<MacroValues?>(null) }
    val openedAt = remember { FoodTime.now() }
    val scrollState = rememberScrollState()
    var detailsY by remember { mutableStateOf(0f) }

    LaunchedEffect(id, registration) {
        profile = FoodProfile.refresh()
    }

    LaunchedEffect(id, registration, forDish) {
        if (id.isEmpty() && registration != null) return@LaunchedEffect
        try {
            val product = ApiJson.decodeFromJsonElement(ProductResponse.serializer(), Api.get("/api/products/$id")).product
            if (product == null) {
                state = if (registration != null) LoadState.Loaded(productFromRegistration(registration)) else LoadState.NotFound
                return@LaunchedEffect
            }
            state = LoadState.Loaded(applyRegistrationSnapshot(product, registration))
            if (registration == null) {
                // Start amount: own last amount, serving unit, typical amount for the category (src/lib/default-amount.ts).
                amount = defaultAmountGrams(product, mediumHandSizeGrams(product.name))
                val context = if (forDish) "RECIPE" else "EATEN"
                runCatching {
                    val grams = Api.get("/api/amount-suggestion?itemId=${encodeUri(id)}&context=$context").obj("suggestion").num("grams")
                    if (grams != null && grams > 0 && !amountTouched) amount = grams
                }
            }
        } catch (e: ApiException) {
            state = if (e.status == 404) {
                if (registration != null) LoadState.Loaded(productFromRegistration(registration)) else LoadState.NotFound
            } else LoadState.Failed
        } catch (_: Exception) {
            state = LoadState.Failed
        }
    }

    LaunchedEffect(id) {
        if (id.isEmpty()) return@LaunchedEffect
        isFavorite = runCatching {
            ApiJson.decodeFromJsonElement(FavoritesResponse.serializer(), Api.get("/api/favorites")).favorites.any { it.product?.id == id }
        }.getOrDefault(false)
        photoAwards = runCatching {
            ApiJson.decodeFromJsonElement(PhotoAwardsResponse.serializer(), Api.get("/api/products/$id/photo-awards")).awards
        }.getOrDefault(emptyList())
    }

    val loaded = (state as? LoadState.Loaded)?.product
    val isLoading = state == LoadState.Loading
    val pendingFields = loaded?.pendingFields ?: emptyList()
    fun isPending(field: String) = isLoading || field in pendingFields
    val ownProduct = loaded != null && profile?.id != null && loaded.createdByUserId == profile?.id
    val createdAtMs = FoodTime.parse(loaded?.createdAt)?.toEpochMilliseconds()
    val awaitingCutout = ownProduct && loaded?.pendingImageUrl == null && createdAtMs != null &&
        openedAt.toEpochMilliseconds() - createdAtMs < CUTOUT_WAIT_MS
    val shouldPoll = pendingFields.isNotEmpty() || awaitingCutout

    // "Opret straks": re-fetch while OpenAI still reads fields or the cut-out image is pending.
    LaunchedEffect(shouldPoll, state) {
        if (!shouldPoll) return@LaunchedEffect
        delay(PENDING_POLL_MS)
        runCatching {
            val product = ApiJson.decodeFromJsonElement(ProductResponse.serializer(), Api.get("/api/products/$id")).product
            if (product != null && state is LoadState.Loaded) state = LoadState.Loaded(applyRegistrationSnapshot(product, registration))
        }
    }

    LaunchedEffect(loaded?.additives) {
        val codes = loaded?.additives ?: return@LaunchedEffect
        if (codes.isEmpty()) return@LaunchedEffect
        val names = additiveNames.toMutableMap()
        for (code in codes) {
            val info = Additives.info(code)
            names[code] = info.danishName.ifEmpty { info.internationalName.ifEmpty { code } }
        }
        additiveNames = names
    }

    fun toggleFavorite() {
        if (favoritePending) return
        val next = !isFavorite
        isFavorite = next
        favoritePending = true
        scope.launch {
            try {
                if (next) Api.post("/api/favorites", mapOf("productId" to id)) else Api.delete("/api/favorites", mapOf("productId" to id))
            } catch (_: Exception) {
                isFavorite = !next
            }
            favoritePending = false
        }
    }

    val product = loaded
    val displayImageUrl: String? = when {
        product == null -> null
        forDish -> selectRawContextImageUrl(product.imageUrl, product.images)
        product.pendingImageUrl != null && product.createdByUserId != null && product.createdByUserId == profile?.id -> product.pendingImageUrl
        else -> product.imageUrl
    }
    val factor = amount / 100
    val handSizeItem = remember(product?.name) { findHandSizeItem(product?.name) }
    val servingSizeGrams = product?.servingSizeGrams
    val unitSingular = product?.servingSizeUnitSingular
    val unitPlural = product?.servingSizeUnitPlural
    val hasServingUnit = servingSizeGrams != null && servingSizeGrams > 0 && unitSingular != null && unitPlural != null
    val step = if (servingSizeGrams != null && servingSizeGrams > 0 && amountUnit == "personer") servingSizeGrams else 10.0
    val displayUnit = productDisplayUnit(product)
    val displayAmount = toDisplayAmount(amount, displayUnit)
    val baseUnitLabel = when (displayUnit) {
        DisplayUnit.CL -> t.t("addProduct.centilitresUnit")
        DisplayUnit.ML -> t.t("addProduct.millilitresUnit")
        DisplayUnit.G -> t.t("addProduct.gramsUnit")
    }
    val defaultMacros = if (product != null) {
        MacroValues(amount, round1(product.proteinPer100g * factor), round1(product.carbsPer100g * factor), round1(product.fatPer100g * factor))
    } else MacroValues(amount, 0.0, 0.0, 0.0)
    val macros = macroOverride?.takeIf { it.amount == amount } ?: defaultMacros
    val confidentServings = product?.alternativeServings.orEmpty().filter(::isAlternativeServingConfident)

    val extendedNutrition: List<NutrientRow> = remember(product, amount, t) {
        if (product == null) return@remember emptyList()
        if (product.nutrients.isNotEmpty()) {
            product.nutrients.mapNotNull { n ->
                val def = NUTRIENT_DEFS[n.key] ?: return@mapNotNull null
                NutrientRow(n.key, n.per100g * factor, def.unit, def.digits, n.estimated, n.tolerancePer100g?.let { it * factor }, t.t("addProduct.nutrient.${n.key}"))
            }
        } else {
            val extraFactor = product.servingSizeGrams?.takeIf { it > 0 }?.let { amount / it }
            fun fromExtra(key: String) = if (extraFactor != null) product.extraNumber(key)?.let { it * extraFactor } else null
            fun fromPer100(v: Double?) = v?.let { it * factor }
            listOf(
                Triple("saturatedFat", fromPer100(product.saturatedFatPer100g), "g" to 1),
                Triple("unsaturatedFat", fromPer100(product.unsaturatedFatPer100g), "g" to 1),
                Triple("transFat", fromPer100(product.transFatPer100g), "g" to 2),
                Triple("cholesterol", fromPer100(product.cholesterolPer100g), "mg" to 0),
                Triple("sodium", fromExtra("saltG"), "g" to 1),
                Triple("potassium", fromExtra("potassiumMg"), "mg" to 0),
                Triple("fiber", fromExtra("fiberG"), "g" to 1),
                Triple("sugar", fromExtra("sugarG"), "g" to 1),
                Triple("vitaminA", fromPer100(product.vitaminAPer100g), "µg" to 0),
                Triple("vitaminC", fromPer100(product.vitaminCPer100g), "mg" to 0),
                Triple("calcium", fromExtra("calciumMg"), "mg" to 0),
                Triple("iron", fromExtra("ironMg"), "mg" to 1),
            ).mapNotNull { (key, value, unit) ->
                value?.let { NutrientRow(key, it, unit.first, unit.second, false, null, t.t("addProduct.nutrient.$key")) }
            }
        }
    }
    val extendedOpen = extendedToggle ?: (profile?.showExtendedNutrition == true)
    val visibleAllergens = if (product == null || profile?.showAllergens != true) emptyList()
    else product.allergens.filter { profile?.allergenVisible(it) != false }
    val toxinMatches = remember(product?.name, product?.ingredientsText, profile?.showToxins) {
        if (product != null && profile?.showToxins == true) matchToxins(product.name, product.ingredientsText) else emptyList()
    }

    fun handleAdd() {
        saving = true
        saveError = null
        scope.launch {
            try {
                val createdAt = (FoodTime.toInstant(date, time) ?: FoodTime.now()).toString()
                if (registration != null) {
                    Api.patch(
                        "/api/registrations/${registration.id}",
                        mapOf(
                            "amountGrams" to amount,
                            "createdAt" to createdAt,
                            "kcalSnapshot" to (product?.kcalPer100g ?: 0.0) * amount / 100,
                            "proteinSnapshot" to macros.protein,
                            "carbsSnapshot" to macros.carbs,
                            "fatSnapshot" to macros.fat,
                        ),
                    )
                    NativeHooks.onRegistrationChanged()
                    if (!nav.back()) nav.resetTo("/")
                } else {
                    val body = buildMap<String, Any> {
                        if (product?.isGenericIngredient == true) put("genericIngredientId", id) else put("productId", id)
                        put("amountGrams", amount)
                        put("createdAt", createdAt)
                        put("proteinSnapshot", macros.protein)
                        put("carbsSnapshot", macros.carbs)
                        put("fatSnapshot", macros.fat)
                        putAll(MealShare.body())
                    }
                    Api.post("/api/registrations", body)
                    NativeHooks.onRegistrationChanged()
                    nav.resetTo("/")
                }
            } catch (e: ApiException) {
                saveError = e.body.str("message") ?: t.t(if (registration != null) "registration.saveError" else "addProduct.saveError")
            } catch (_: Exception) {
                saveError = t.t("offline.message")
            }
            saving = false
        }
    }

    fun handleAddToDish() {
        val p = product ?: return
        DishDraft.append(
            DishDraftIngredient(
                productId = p.id,
                name = p.name,
                imageUrl = selectRawContextImageUrl(p.imageUrl, p.images),
                kcalPer100g = p.kcalPer100g,
                proteinPer100g = p.proteinPer100g,
                carbsPer100g = p.carbsPer100g,
                fatPer100g = p.fatPer100g,
                grams = amount,
            ),
        )
        nav.push("/create-dish")
    }

    val heading = product?.let { splitProductHeading(it) } ?: ProductHeading("", emptyList())
    val (productTitle, certifications) = if (product != null) extractCertifications(heading.title) else ("" to emptyList())
    val isCutout = displayImageUrl?.contains("/cutouts/") == true
    val view = product ?: if (isLoading) ProductDto() else null
    val subtitle = if (view != null) (listOf(view.packageSizeText) + heading.variants).filter { !it.isNullOrBlank() }.joinToString(" · ") else ""
    val title = if (forDish) t.t("addProduct.titleForDish") else t.t("addProduct.title")

    Column(Modifier.fillMaxSize().background(HcColors.Page)) {
        HcAppBar(title)
        val offer = product?.updateOffer
        Box(Modifier.weight(1f).fillMaxWidth()) {
        Column(Modifier.fillMaxSize().verticalScroll(scrollState)) {
            if (state == LoadState.NotFound || state == LoadState.Failed) {
                HcCard(Modifier.padding(16.dp)) {
                    HcText(
                        t.t(if (state == LoadState.NotFound) "addProduct.notFound" else "addProduct.error"),
                        HcTypeRoles.Body,
                        Modifier.fillMaxWidth(),
                        color = HcColors.TextSecondary,
                        align = TextAlign.Center,
                    )
                }
            }
            if (view != null) {
                if (!isLoading && !forDish && id.isNotEmpty() && photoAwards.isNotEmpty()) {
                    val bannerText = if (photoAwards.size == 1) {
                        val award = photoAwards.first()
                        t.t("photoAward.bannerSingle", "points" to award.points, "photoType" to t.t(photoTypeKey(award.photoType)))
                    } else t.t("photoAward.bannerMultiple", "points" to photoAwards.sumOf { it.points })
                    Box(
                        Modifier.fillMaxWidth().height(HcDimens.ControlHeight).background(HcColors.Black).clickable { nav.push("/add/$id/photo-award") }.padding(horizontal = 16.dp),
                        contentAlignment = Alignment.Center,
                    ) { HcText(bannerText, HcTypeRoles.Small, color = HcColors.White, bold = true, align = TextAlign.Center) }
                }

                Box(Modifier.fillMaxWidth().padding(16.dp)) {
                    Column(Modifier.fillMaxWidth()) {
                        Column(Modifier.fillMaxWidth().padding(top = 46.dp), verticalArrangement = Arrangement.spacedBy(33.dp)) {
                            ProductCircle(
                                imageUrl = displayImageUrl,
                                isCutout = isCutout,
                                landscape = imageLandscape,
                                onLandscape = { imageLandscape = it },
                                showSkeleton = shouldPoll || isLoading,
                                showFavorite = !isLoading && !view.isGenericIngredient,
                                isFavorite = isFavorite,
                                favoriteLabel = t.t(if (isFavorite) "search.removeFavorite" else "search.addFavorite"),
                                onToggleFavorite = ::toggleFavorite,
                                brand = view.brand,
                                certifications = certifications,
                                modifier = Modifier.align(Alignment.CenterHorizontally),
                            )
                            Column(Modifier.fillMaxWidth()) {
                                if (isPending("name")) FoodSkeleton(Modifier.width(200.dp).height(36.dp))
                                else HcText(productTitle, HcTypeRoles.Hero, color = HcColors.Black)
                                HcText(subtitle.ifEmpty { " " }, HcTypeRoles.Hero, color = HcColors.Green)
                            }
                        }

                        Row(
                            Modifier.align(Alignment.CenterHorizontally).padding(top = 14.dp, bottom = 16.dp).clip(RoundedCornerShape(4.dp))
                                .clickable { scope.launch { scrollState.animateScrollTo(detailsY.toInt()) } }.padding(4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            HcText(t.t("addProduct.details"), HcTypeRoles.Button, color = HcColors.Black)
                            HcIcon("ChevronDown", size = 15.dp, color = HcColors.Black)
                        }

                        if (hasServingUnit) {
                            Row(Modifier.fillMaxWidth().padding(bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
                                FoodPillButton(unitPlural.orEmpty().replaceFirstChar { it.uppercase() }, amountUnit == "personer", { amountUnit = "personer" })
                                FoodPillButton(baseUnitLabel, amountUnit == "gram", { amountUnit = "gram" })
                            }
                        }

                        if (handSizeItem != null && amountUnit == "gram") {
                            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                                HandSizePickerRow(handSizeItem, displayImageUrl, amount, ::setAmount)
                            }
                        }

                        AmountStepper(
                            isLoading = isLoading,
                            nutritionPending = isPending("nutrition"),
                            servingMode = hasServingUnit && amountUnit == "personer",
                            servingText = if (servingSizeGrams != null && servingSizeGrams > 0) {
                                "${jsRound(amount / servingSizeGrams)} ${if (amount == servingSizeGrams) unitSingular else unitPlural}".replaceFirstChar { it.uppercase() }
                            } else "",
                            displayAmount = displayAmount,
                            displayUnit = displayUnit,
                            perPieceSuffix = if (!hasServingUnit && displayUnit == DisplayUnit.G && servingSizeGrams == amount) t.t("addProduct.perPiece") else "",
                            kcalLine = if (view.hasKnownNutrition == false) t.t("addProduct.nutritionUnknown")
                            else t.t("addProduct.kcalAmount", "kcal" to jsRound(view.kcalPer100g * amount / 100)),
                            onMinus = { setAmount(maxOf(step, amount - step)) },
                            onPlus = { setAmount(amount + step) },
                            onTyped = { setAmount(maxOf(0.0, fromDisplayAmount(it, displayUnit))) },
                        )

                        Column(Modifier.fillMaxWidth().padding(bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            when {
                                isPending("nutrition") -> FoodSkeleton(Modifier.width(150.dp).height(18.dp))
                                else -> HcText(
                                    when {
                                        view.hasKnownNutrition == false -> t.t("addProduct.nutritionUnknown")
                                        servingSizeGrams != null && hasServingUnit -> t.t(
                                            "addProduct.kcalPerServing",
                                            "kcal" to jsRound(view.kcalPer100g * servingSizeGrams / 100),
                                            "unit" to unitSingular.orEmpty(),
                                        )
                                        displayUnit == DisplayUnit.G -> t.t("addProduct.kcalPer100g", "kcal" to jsRound(view.kcalPer100g))
                                        else -> t.t("addProduct.kcalPer100ml", "kcal" to jsRound(view.kcalPer100g))
                                    },
                                    HcTypeRoles.Body,
                                    color = HcColors.Black,
                                    align = TextAlign.Center,
                                )
                            }
                            confidentServings.forEach { serving ->
                                HcText(
                                    t.t("addProduct.alternativeServing", "label" to serving.label, "kcal" to jsRound(serving.kcal ?: 0.0)),
                                    HcTypeRoles.Small,
                                    Modifier.padding(top = 2.dp),
                                    color = HcColors.TextSecondary,
                                )
                            }
                        }
                    }
                    if (!isLoading && !forDish && id.isNotEmpty()) {
                        Box(Modifier.align(Alignment.TopEnd).offset(y = (-8).dp)) { ForwardButton("PRODUCT", view.id, view.name) }
                    }
                }

                // Details (border-t, 32 px between sections).
                Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.TanDark))
                Column(
                    Modifier.fillMaxWidth().onGloballyPositioned { detailsY = it.positionInParent().y }.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(32.dp),
                ) {
                    if (profile?.showAdditives == true && view.additives.isNotEmpty()) {
                        AdditivesCard(view.additives, additiveNames) { openAdditive = it }
                    }

                    Column {
                        Row(Modifier.fillMaxWidth().padding(bottom = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                            HcText(t.t("common.macroBreakdown"), HcTypeRoles.Title, Modifier.weight(1f), color = HcColors.Black, bold = true)
                            if (!isLoading) {
                                if (unlocked) {
                                    Box(Modifier.size(44.dp).clip(CircleShape).clickable { macroOverride = overrideSnapshot }, contentAlignment = Alignment.Center) {
                                        HcIcon("Refresh", size = 20.dp, color = HcColors.Black)
                                    }
                                }
                                Box(
                                    Modifier.size(44.dp).clip(CircleShape).clickable {
                                        if (!unlocked) overrideSnapshot = macroOverride
                                        unlocked = !unlocked
                                    },
                                    contentAlignment = Alignment.Center,
                                ) { HcIcon(if (unlocked) "LockOpen" else "Lock", size = 20.dp, color = HcColors.Black) }
                            }
                        }
                        if (isPending("nutrition")) {
                            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                listOf(0.22f, 0.36f, 0.18f).forEach { w ->
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(Modifier.fillMaxWidth()) {
                                            FoodSkeleton(Modifier.fillMaxWidth(w).height(18.dp))
                                            Box(Modifier.weight(1f))
                                            FoodSkeleton(Modifier.width(44.dp).height(20.dp))
                                        }
                                        FoodSkeleton(Modifier.fillMaxWidth().height(8.dp))
                                    }
                                }
                            }
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                FoodMacroSliderBar(t.t("common.protein"), macros.protein, maxOf(30.0, kotlin.math.ceil(defaultMacros.protein * 2)), { macroOverride = macros.copy(amount = amount, protein = it) }, disabled = !unlocked)
                                FoodMacroSliderBar(t.t("common.carbs"), macros.carbs, maxOf(40.0, kotlin.math.ceil(defaultMacros.carbs * 2)), { macroOverride = macros.copy(amount = amount, carbs = it) }, disabled = !unlocked)
                                FoodMacroSliderBar(t.t("common.fat"), macros.fat, maxOf(20.0, kotlin.math.ceil(defaultMacros.fat * 2)), { macroOverride = macros.copy(amount = amount, fat = it) }, disabled = !unlocked)
                            }
                        }
                        CertificationLogosRow(certificationBadges(view.filters, view.labels), Modifier.padding(top = 16.dp))
                    }

                    if (toxinMatches.isNotEmpty()) {
                        Column {
                            Row(Modifier.fillMaxWidth().clickable { toxinsOpen = !toxinsOpen }.padding(bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                                HcText(t.t("addProduct.toxins"), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black, bold = true)
                                FoldChevron(toxinsOpen, 18.dp)
                            }
                            if (toxinsOpen) {
                                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.Tan)) {
                                    toxinMatches.forEachIndexed { index, match ->
                                        Row(
                                            Modifier.fillMaxWidth().clickable { openToxin = match.toxin }.padding(horizontal = 16.dp, vertical = 12.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                                        ) {
                                            HcIcon("AlertTriangle", size = 18.dp, color = HcColors.Black)
                                            Row(Modifier.weight(1f)) {
                                                HcText(match.toxin.name, HcTypeRoles.Small, color = HcColors.TextSecondary, underline = true)
                                                HcText(" (${match.matchedTerm})", HcTypeRoles.Small, color = HcColors.TextSecondary)
                                            }
                                            if (match.toxin.pregnancy != null || match.toxin.fertility != null) {
                                                HcText(
                                                    t.t("addProduct.toxinPregnancyBadge"),
                                                    HcTypeRoles.Micro,
                                                    Modifier.clip(RoundedCornerShape(50)).background(HcColors.White).padding(horizontal = 8.dp, vertical = 2.dp),
                                                    color = HcColors.Black,
                                                )
                                            }
                                        }
                                        if (index < toxinMatches.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.TanDark))
                                    }
                                    HcText(t.t("addProduct.toxinsDisclaimer"), HcTypeRoles.Micro, Modifier.padding(horizontal = 16.dp, vertical = 10.dp), color = HcColors.TextSecondary)
                                }
                            }
                        }
                    }

                    val websiteUrl = view.recipeDetails?.websiteUrl
                    if (!isLoading && view.externalSource == "VALDEMARSRO" && !websiteUrl.isNullOrEmpty()) {
                        HcButton(t.t("recipes.goToRecipe"), onClick = { NativeHooks.openExternalUrl(websiteUrl) })
                    }

                    if (visibleAllergens.isNotEmpty()) {
                        Column {
                            Row(Modifier.padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Box(Modifier.size(20.dp).clip(CircleShape).background(HcColors.Green), contentAlignment = Alignment.Center) {
                                    HcText("!", HcTypeRoles.Small, color = HcColors.White, bold = true)
                                }
                                HcText(t.t("addProduct.allergens"), HcTypeRoles.Body, color = HcColors.Black, bold = true)
                            }
                            HcText(visibleAllergens.joinToString(", ") { labelForAllergen(it) }, HcTypeRoles.Small, color = HcColors.TextSecondary)
                            HcText(t.t("addProduct.allergenDisclaimer"), HcTypeRoles.Micro, Modifier.padding(top = 8.dp), color = HcColors.TextSecondary)
                        }
                    }

                    if (isPending("ingredients") || !view.ingredientsText.isNullOrEmpty() || view.ingredientsUnreadable) {
                        Column {
                            HcText(t.t("createDish.ingredients"), HcTypeRoles.Body, Modifier.padding(bottom = 8.dp), color = HcColors.Black)
                            when {
                                isPending("ingredients") -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf(0.94f, 0.82f, 0.88f, 0.46f).forEach { FoodSkeleton(Modifier.fillMaxWidth(it).height(16.dp)) }
                                }
                                view.ingredientsText.isNullOrEmpty() -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                    HcText(t.t("addProduct.ingredientsUnreadable"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                                    HcButton(
                                        t.t("addProduct.retakeIngredients"),
                                        onClick = { nav.push("/camera?mode=product&retake=ingredients&product=${encodeUri(id)}") },
                                        kind = dk.packroff.hellocal.ui.HcButtonKind.Secondary,
                                        leading = { HcIcon("Camera", size = 19.dp, color = HcColors.Action) },
                                    )
                                }
                                else -> IngredientsTextView(view.ingredientsText) { openAdditive = it }
                            }
                        }
                    }

                    if (extendedNutrition.isNotEmpty()) {
                        ExtendedNutritionSection(
                            rows = extendedNutrition,
                            open = extendedOpen,
                            onToggle = { extendedToggle = !extendedOpen },
                            autoExpand = profile?.autoExpandUncertainty == true,
                            toggled = uncertaintyToggled,
                            onToggleRow = { key -> uncertaintyToggled = if (key in uncertaintyToggled) uncertaintyToggled - key else uncertaintyToggled + key },
                            onMicronutrient = { openMicronutrient = it },
                        )
                    }

                    if (view.barcodes.isNotEmpty() && view.createdByUserId != profile?.id) {
                        HcButton(
                            t.t("addProduct.reportBug"),
                            onClick = { nav.push("/profile/report-bug?productId=$id") },
                            leading = { HcIcon("Message", size = 18.dp, color = HcColors.White) },
                        )
                    }
                }
            }
        }
        if (!isLoading && !forDish && !isEditing && id.isNotEmpty() && offer != null) {
            val tileKeys = mapOf("FRONT" to "productUpdate.tileFront", "NUTRITION" to "productUpdate.tileNutrition", "INGREDIENTS" to "productUpdate.tileIngredients")
            UpdatePointsBanner(
                "/add/${encodeUri(id)}/update",
                t.t("productUpdate.banner", "points" to offer.points),
                t.t("productUpdate.toggle"),
                offer.kinds.mapNotNull { k -> tileKeys[k]?.let { t.t(it) } },
            ) {
                if (product?.ingredientsUnreadable == true) {
                    HcButton(
                        t.t("addProduct.retakeIngredients"),
                        onClick = { nav.push("/camera?mode=product&retake=ingredients&product=${encodeUri(id)}") },
                        kind = dk.packroff.hellocal.ui.HcButtonKind.Secondary,
                        leading = { HcIcon("Camera", size = 19.dp, color = HcColors.Action) },
                    )
                }
            }
        }
        }

        // Footer (fixed under the scroll area).
        if (product != null) {
            Column(Modifier.fillMaxWidth().background(HcColors.Cream).padding(16.dp)) {
                if (!forDish && !isEditing) {
                    Box(Modifier.padding(bottom = 16.dp)) { FoodMealShareBar() }
                }
                saveError?.let { HcText(it, HcTypeRoles.Body, Modifier.fillMaxWidth().padding(bottom = 8.dp), color = HcColors.TextSecondary, align = TextAlign.Center) }
                HcButton(
                    when {
                        forDish -> t.t("addProduct.addToDish")
                        saving -> t.t("createDish.saving")
                        isEditing -> t.t("registration.save")
                        else -> t.t("addProduct.add")
                    },
                    onClick = { if (forDish) handleAddToDish() else handleAdd() },
                    enabled = !saving,
                )
            }
        } else if (isLoading) {
            Box(Modifier.fillMaxWidth().padding(16.dp)) { FoodSkeleton(Modifier.fillMaxWidth().height(HcDimens.ControlHeight), RoundedCornerShape(HcDimens.RadiusCard)) }
        }
    }

    openAdditive?.let { AdditiveInfoSheet(it) { openAdditive = null } }
    openMicronutrient?.let { MicronutrientInfoSheet(it) { openMicronutrient = null } }
    openToxin?.let { ToxinInfoSheet(it) { openToxin = null } }
}

fun photoTypeKey(type: String) = when (type) {
    "BARCODE" -> "photoAward.photoTypeBarcode"
    "NUTRITION" -> "photoAward.photoTypeNutrition"
    else -> "photoAward.photoTypeIngredients"
}

/** The 180 px tan circle with the product photo / cut-out, favourite button, brand and certifications. */
@Composable
private fun ProductCircle(
    imageUrl: String?,
    isCutout: Boolean,
    landscape: Boolean,
    onLandscape: (Boolean) -> Unit,
    showSkeleton: Boolean,
    showFavorite: Boolean,
    isFavorite: Boolean,
    favoriteLabel: String,
    onToggleFavorite: () -> Unit,
    brand: ProductBrand?,
    certifications: List<NameCertification>,
    modifier: Modifier = Modifier,
) {
    Box(modifier.size(180.dp)) {
        Box(Modifier.size(180.dp).clip(CircleShape).background(HcColors.Tan), contentAlignment = Alignment.Center) {
            when {
                imageUrl != null && !isCutout -> FoodImage(imageUrl, Modifier.size(180.dp).padding(12.dp), ContentScale.Fit)
                imageUrl == null && showSkeleton -> FoodSkeleton(Modifier.size(180.dp), CircleShape)
            }
        }
        if (imageUrl != null && isCutout) {
            // Cut-out product: 110 % of the circle — standing items rise 10 % above it, lying items 10 % to the right.
            val model = Api.absoluteUrl(imageUrl)
            AsyncImage(
                model = model,
                contentDescription = null,
                contentScale = ContentScale.Fit,
                onState = { s -> if (s is AsyncImagePainter.State.Success) onLandscape(s.result.image.width > s.result.image.height) },
                modifier = if (landscape) Modifier.align(Alignment.CenterStart).width(198.dp)
                else Modifier.align(Alignment.BottomCenter).height(198.dp),
            )
        }
        if (showFavorite) {
            Box(
                Modifier.align(Alignment.TopEnd).offset(x = (-8).dp, y = 8.dp).size(44.dp).clip(CircleShape)
                    .background(HcColors.Black.copy(alpha = 0.78f)).clickable(onClick = onToggleFavorite),
                contentAlignment = Alignment.Center,
            ) { FoodFavoriteIcon(isFavorite, 24.dp, HcColors.White) }
        }
        if (brand != null) {
            Box(Modifier.align(Alignment.BottomStart).offset(x = (135 + 12).dp)) {
                if (!brand.logoUrl.isNullOrEmpty()) {
                    FoodImage(brand.logoUrl, Modifier.size(95.dp, 66.dp), ContentScale.Fit, contentDescription = brand.name)
                } else {
                    Text(brand.name, style = HcTypeRoles.Title.style(HcColors.Green).copy(fontWeight = FontWeight.Bold), maxLines = 1, softWrap = false)
                }
            }
        }
        if (certifications.isNotEmpty()) {
            Row(Modifier.align(Alignment.BottomStart).padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                certifications.forEach { FoodImage("/certifications/${it.file}", Modifier.height(30.dp).widthIn(max = 60.dp), ContentScale.FillHeight, contentDescription = it.label) }
            }
        }
    }
}

/** − [amount] + with the kcal for the amount. */
@Composable
private fun AmountStepper(
    isLoading: Boolean,
    nutritionPending: Boolean,
    servingMode: Boolean,
    servingText: String,
    displayAmount: Double,
    displayUnit: DisplayUnit,
    perPieceSuffix: String,
    kcalLine: String,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
    onTyped: (Double) -> Unit,
) {
    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        Row(Modifier.widthIn(max = 320.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GlyphButton("−", onMinus)
            Column(
                Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(HcColors.Tan).padding(vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                when {
                    isLoading -> FoodSkeleton(Modifier.width(96.dp).height(28.dp))
                    servingMode -> HcText(servingText, HcTypeRoles.PageTitle, color = HcColors.Black)
                    else -> {
                        var text by remember(displayAmount) { mutableStateOf(jsNumberText(displayAmount)) }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            BasicTextField(
                                value = text,
                                onValueChange = { next ->
                                    text = next
                                    next.replace(",", ".").toDoubleOrNull()?.let(onTyped)
                                },
                                singleLine = true,
                                textStyle = HcTypeRoles.PageTitle.style(HcColors.Black).copy(textAlign = TextAlign.End),
                                cursorBrush = SolidColor(HcColors.Action),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.width(((text.length.coerceAtLeast(1) + 0.5f) * 13).dp),
                            )
                            HcText(" ${displayUnit.label}$perPieceSuffix", HcTypeRoles.PageTitle, color = HcColors.Black)
                        }
                    }
                }
                if (nutritionPending) FoodSkeleton(Modifier.padding(vertical = 2.dp).width(64.dp).height(14.dp))
                else HcText(kcalLine, HcTypeRoles.Body, color = HcColors.TextSecondary, align = TextAlign.Center)
            }
            GlyphButton("+", onPlus)
        }
    }
}

/** The additives card (border-2 border-hf-green). */
@Composable
private fun AdditivesCard(codes: List<String>, names: Map<String, String>, onOpen: (String) -> Unit) {
    val t = LocalTranslator.current
    FoodOutlinedCard {
        Row(Modifier.padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(48.dp).clip(RoundedCornerShape(8.dp)).background(HcColors.Green), contentAlignment = Alignment.Center) {
                HcText("E", HcTypeRoles.PageTitle, color = HcColors.White, bold = true)
            }
            Column {
                HcText(t.t("addProduct.additives"), HcTypeRoles.Title, color = HcColors.Black, bold = true)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    HcIcon("AlertTriangle", size = 16.dp, color = HcColors.Black)
                    HcText(t.t("addProduct.additivesWarning"), HcTypeRoles.Small, color = HcColors.Black, bold = true)
                }
            }
        }
        codes.forEachIndexed { index, code ->
            Row(
                Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { onOpen(code) }.padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                HcText(code.uppercase(), HcTypeRoles.Small, color = HcColors.Black, bold = true)
                HcText(names[code] ?: code.uppercase(), HcTypeRoles.Small, color = HcColors.TextSecondary, underline = true)
            }
            if (index < codes.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.TanDark))
        }
    }
}

private val UNHEALTHY_FAT_KEYS = setOf("saturatedFat", "transFat")

/** "Næringsdetaljer" with "Vis mere": rows with the uncertainty ~ and the grey tolerance line. */
@Composable
private fun ExtendedNutritionSection(
    rows: List<NutrientRow>,
    open: Boolean,
    onToggle: () -> Unit,
    autoExpand: Boolean,
    toggled: Set<String>,
    onToggleRow: (String) -> Unit,
    onMicronutrient: (String) -> Unit,
) {
    val t = LocalTranslator.current
    Column {
        Row(Modifier.fillMaxWidth().clickable(onClick = onToggle), verticalAlignment = Alignment.CenterVertically) {
            HcText(t.t("addProduct.extendedNutrition"), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black, bold = true)
            HcText(if (open) t.t("addProduct.showLess") else t.t("addProduct.showMore"), HcTypeRoles.Small, color = HcColors.Black, bold = true, underline = true)
            FoldChevron(open)
        }
        if (open) {
            Column(Modifier.padding(top = 16.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.Tan)) {
                rows.forEachIndexed { index, row ->
                    val hasUncertainty = row.estimated || (row.tolerance ?: 0.0) > 0
                    val expanded = hasUncertainty && autoExpand != (row.key in toggled)
                    Column(
                        Modifier.fillMaxWidth().let { if (hasUncertainty) it.clickable { onToggleRow(row.key) } else it }.padding(horizontal = 16.dp, vertical = 10.dp),
                    ) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                if (row.key in UNHEALTHY_FAT_KEYS) HcIcon("AlertTriangle", size = 15.dp, color = HcColors.Black, contentDescription = t.t("addProduct.unhealthyFat"))
                                if (FoodReferenceData.micronutrientByKey.containsKey(row.key)) {
                                    HcText(row.label, HcTypeRoles.Small, Modifier.clickable { onMicronutrient(row.key) }, color = HcColors.Black, underline = true)
                                } else {
                                    HcText(row.label, HcTypeRoles.Small, color = HcColors.Black.copy(alpha = 0.7f))
                                }
                                if (hasUncertainty) FoldChevron(expanded, 13.dp)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (row.estimated) FoodUncertaintyTilde()
                                HcText("${daNumber(row.value, row.digits)} ${row.unit}", HcTypeRoles.Small, color = HcColors.Black, bold = true)
                            }
                        }
                        if (expanded) {
                            val hasEstimate = row.estimated && row.value > 0
                            val tolerance = row.tolerance?.takeIf { it > 0 }
                            if (hasEstimate || tolerance != null) {
                                Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                                    if (tolerance != null) HcText("±${daNumber(tolerance, row.digits)} ${row.unit}", HcTypeRoles.Small, color = HcColors.Black.copy(alpha = 0.6f))
                                    if (tolerance != null && hasEstimate) HcText("  ", HcTypeRoles.Small)
                                    if (hasEstimate) {
                                        FoodUncertaintyTilde(small = true)
                                        HcText("${daNumber(row.value, row.digits)} ${row.unit}", HcTypeRoles.Small, color = HcColors.Black.copy(alpha = 0.6f))
                                    }
                                }
                            }
                        }
                    }
                    if (index < rows.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.TanDark))
                }
                HcText(t.t("addProduct.extendedNutritionDisclaimer"), HcTypeRoles.Micro, Modifier.padding(horizontal = 16.dp, vertical = 10.dp), color = HcColors.TextSecondary)
            }
        }
    }
}

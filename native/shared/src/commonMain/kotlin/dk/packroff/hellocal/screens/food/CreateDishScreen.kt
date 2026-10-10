package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import dk.packroff.hellocal.ui.FoodSheetDots
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.screens.capture.PersonsSlider
import dk.packroff.hellocal.screens.capture.RecipePortions
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.ui.HcAccordionCard
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FoodDivider
import dk.packroff.hellocal.ui.FoodImage
import dk.packroff.hellocal.ui.FoodListCard
import dk.packroff.hellocal.ui.FoodPillField
import dk.packroff.hellocal.ui.FoodRemoveButton
import dk.packroff.hellocal.ui.FoodSearchField
import dk.packroff.hellocal.ui.FoodSkeletonMediaRows
import dk.packroff.hellocal.ui.FoodTextArea
import dk.packroff.hellocal.ui.FoodTileButton
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.FoodScrollSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcLink
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

private const val MAX_RECIPE_IMAGES = 3

// ---------------------------------------------------------------------------
// /api/dishes/parse-text result (src/components/recipes/RecipeImportSheets.tsx ImportResult).

@Serializable
data class ImportedProduct(
    val id: String = "",
    val name: String = "",
    val imageUrl: String? = null,
    val kcalPer100g: Double = 0.0,
    val proteinPer100g: Double = 0.0,
    val carbsPer100g: Double = 0.0,
    val fatPer100g: Double = 0.0,
)

@Serializable
data class ImportedIngredient(val raw: String = "", val name: String = "", val grams: Double? = null, val product: ImportedProduct? = null)

@Serializable
data class ImportedNutrition(val kcal: Double? = null, val protein: Double? = null, val carbs: Double? = null, val fat: Double? = null, val perServing: Boolean = false)

@Serializable
data class ImportResult(
    val title: String = "",
    val servings: Int? = null,
    val steps: List<String> = emptyList(),
    val nutrition: ImportedNutrition? = null,
    val ingredients: List<ImportedIngredient> = emptyList(),
    val image: String? = null,
    val pageImages: List<String> = emptyList(),
    val description: String? = null,
    val durationMinutes: Int? = null,
    val stepTitles: List<String>? = null,
)

private suspend fun parseRecipeText(text: String): ImportResult {
    val body = buildMap<String, Any> {
        put("text", text)
    }
    return ApiJson.decodeFromJsonElement(ImportResult.serializer(), Api.post("/api/dishes/parse-text", body))
}

private data class DishSearchResult(val id: String, val name: String, val imageUrl: String?, val isPrivate: Boolean)

private data class ImportNote(val missing: List<String>, val nutrition: String?)

/** Native port of src/app/create-dish/page.tsx — Opret ret. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun CreateDishScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var details by remember { mutableStateOf(DishDraft.readDetails()) }
    var savedDish by remember { mutableStateOf<Pair<String, List<String>>?>(null) }
    var sharePrompt by remember { mutableStateOf(false) }
    var sharing by remember { mutableStateOf(false) }
    var servings by remember { mutableStateOf<Int?>(null) }
    var sheet by remember { mutableStateOf("none") }
    var importNote by remember { mutableStateOf<ImportNote?>(null) }
    var ingredients by remember { mutableStateOf(DishDraft.read()) }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var ingredientError by remember { mutableStateOf(false) }
    // Pages: [import], title + description + duration, ingredients, one recipe step per page, pictures of the dish.
    var page by remember { mutableStateOf(0) }
    var importMode by remember { mutableStateOf(false) }
    val stepList = details.steps.ifEmpty { listOf(DishDraftStep()) }
    val pageKinds = (if (importMode) listOf("import") else emptyList()) + listOf("title", "ingredients") + stepList.indices.map { "step:$it" } + listOf("images")
    val totalPages = pageKinds.size
    val current = pageKinds[page.coerceIn(0, totalPages - 1)]
    val currentStep = current.removePrefix("step:").toIntOrNull() ?: 0
    fun goTo(next: Int) { page = next.coerceIn(0, totalPages - 1) }
    // Flow step one: three buttons in the middle. Skipped when a draft already exists.
    var started by remember {
        mutableStateOf(details.name.isNotBlank() || ingredients.isNotEmpty() || details.steps.isNotEmpty() || details.images.isNotEmpty())
    }
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<DishSearchResult>>(emptyList()) }
    var searchState by remember { mutableStateOf("idle") }
    var searchError by remember { mutableStateOf<Throwable?>(null) }
    var correction by remember { mutableStateOf(SearchCorrection()) }
    var exactQuery by remember { mutableStateOf<String?>(null) }
    val searchScope = rememberCoroutineScope()

    LaunchedEffect(query, exactQuery) {
        if (query.isBlank()) return@LaunchedEffect
        val exact = exactQuery == query
        correction = SearchCorrection()
        delay(200)
        searchState = "loading"
        try {
            val data = ApiJson.decodeFromJsonElement(ProductListResponse.serializer(), Api.get("/api/products?q=${encodeUri(query)}${if (exact) "&exact=1" else ""}"))
            correction = SearchCorrection.of(data)
            val products = data.products
            results = products.map { DishSearchResult(it.id, it.name, it.imageUrl, false) }
            searchState = "ready"
        } catch (e: Exception) {
            searchError = e
            searchState = "error"
            results = emptyList()
        }
    }

    val hasPrivateIngredient = ingredients.any { DishDraft.isPrivateIngredientId(it.productId) }
    val totalGrams = ingredients.sumOf { it.grams }
    val totalKcal = ingredients.sumOf { it.kcalPer100g * it.grams / 100 }
    val totalProtein = ingredients.sumOf { it.proteinPer100g * it.grams / 100 }
    val totalCarbs = ingredients.sumOf { it.carbsPer100g * it.grams / 100 }
    val totalFat = ingredients.sumOf { it.fatPer100g * it.grams / 100 }

    fun updateDetails(next: DishDraftDetails) {
        details = next
        DishDraft.writeDetails(next)
    }

    fun finish() = nav.push("/profile/recipes?tab=mine")

    fun answerShare(share: Boolean) {
        val dish = savedDish
        if (share && dish != null) {
            sharing = true
            scope.launch {
                val ok = runCatching {
                    Api.patch("/api/dishes/${encodeUri(dish.first)}/share", mapOf("shared" to true, "language" to if (t.locale == Locale.En) "en" else "da"))
                }.isSuccess
                sharing = false
                if (!ok) saveError = t.t("createDish.shareError")
                sharePrompt = false
            }
        } else {
            sharePrompt = false
        }
    }

    fun applyImport(result: ImportResult) {
        page = 1
        val missing = mutableListOf<String>()
        for (ingredient in result.ingredients) {
            val product = ingredient.product
            val grams = ingredient.grams
            if (product != null && grams != null && grams > 0) {
                DishDraft.append(
                    DishDraftIngredient(product.id, product.name, product.imageUrl, product.kcalPer100g, product.proteinPer100g, product.carbsPer100g, product.fatPer100g, grams),
                )
            } else {
                missing += ingredient.raw
            }
        }
        ingredients = DishDraft.read()
        result.servings?.let { servings = it }
        val nextImages = if (result.image != null) listOf(result.image) + details.images else details.images
        val nextSteps = result.steps.mapIndexed { index, text -> DishDraftStep(result.stepTitles?.getOrNull(index) ?: "", text, result.pageImages.getOrNull(index)) }
        updateDetails(
            details.copy(
                name = result.title.ifEmpty { details.name },
                description = result.description?.takeIf { it.isNotBlank() } ?: details.description,
                durationMinutes = result.durationMinutes ?: details.durationMinutes,
                images = nextImages,
                showImages = nextImages.isNotEmpty() || details.showImages,
                steps = nextSteps.ifEmpty { details.steps },
                showSteps = nextSteps.isNotEmpty() || details.showSteps,
            ),
        )
        val n = result.nutrition
        importNote = ImportNote(
            missing,
            n?.let {
                listOfNotNull(
                    it.kcal?.let { v -> "${jsNumberText(v)} kcal" },
                    it.protein?.let { v -> "${jsNumberText(v)} g protein" },
                    it.carbs?.let { v -> "${jsNumberText(v)} g kulhydrat" },
                    it.fat?.let { v -> "${jsNumberText(v)} g fedt" },
                ).joinToString(" · ")
            },
        )
    }

    fun save() {
        saveError = null
        ingredientError = false
        if (details.name.isBlank()) {
            saveError = t.t("createDish.nameRequired")
            page = pageKinds.indexOf("title")
            return
        }
        if (ingredients.isEmpty()) {
            ingredientError = true
            page = pageKinds.indexOf("ingredients")
            return
        }
        saving = true
        scope.launch {
            try {
                val body = mapOf(
                    "name" to details.name.trim(),
                    "servings" to servings,
                    "description" to details.description.trim(),
                    "durationMinutes" to details.durationMinutes,
                    "ingredients" to ingredients.map { mapOf("productId" to it.productId, "grams" to it.grams) },
                    "images" to details.images,
                    "steps" to details.steps.filter { !it.isEmpty() }.map { mapOf("title" to it.title, "text" to it.text, "image" to it.image) },
                )
                val data = Api.post("/api/dishes", body)
                DishDraft.clear()
                val dishId = data.obj("dish").str("id")
                if (dishId != null) {
                    val tags = data.arr("suggestedTags")?.mapNotNull { (it as? kotlinx.serialization.json.JsonPrimitive)?.content } ?: emptyList()
                    savedDish = dishId to tags
                    sharePrompt = !hasPrivateIngredient
                } else {
                    finish()
                }
            } catch (e: ApiException) {
                saveError = e.body.str("message") ?: t.t("createDish.saveError")
            } catch (_: Exception) {
                saveError = t.t("createDish.saveError")
            }
            saving = false
        }
    }

    if (!started) {
        HcScreen(
            t.t("createDish.title"),
            icon = { HcIcon("Soup", size = 20.dp, stroke = 2f, color = HcColors.White) },
            contentPadding = LIST_PAGE_PADDING,
        ) {
            StartOptionTiles(
                listOf(
                    t.t("createDish.modeText") to "paste",
                    t.t("createDish.modeScan") to "scan",
                    t.t("createDish.modeManual") to "none",
                ),
            ) { target -> importMode = target != "none"; sheet = target; started = true }
        }
        if (sheet == "paste") PasteTextSheet(onClose = { sheet = "none" }, onResult = ::applyImport)
        if (sheet == "scan") ScanSheet(onClose = { sheet = "none" }, onResult = ::applyImport)
        return
    }

    HcScreen(
        t.t("createDish.title"),
        icon = { HcIcon("Soup", size = 20.dp, stroke = 2f, color = HcColors.White) },
        contentPadding = LIST_PAGE_PADDING,
        bottom = {
            saveError?.let { HcText(it, HcTypeRoles.Body, Modifier.fillMaxWidth().padding(bottom = 8.dp), color = HcColors.TextSecondary, align = TextAlign.Center) }
            Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                PageArrow("ChevronLeft", enabled = page > 0) { goTo(page - 1) }
                FoodSheetDots(totalPages, page) { goTo(it) }
                PageArrow("ChevronRight", enabled = page < totalPages - 1) { goTo(page + 1) }
            }
        },
        trailing = {
            Box(
                Modifier.clip(RoundedCornerShape(50)).background(HcColors.Black).alpha(if (!saving && savedDish == null) 1f else 0.4f)
                    .clickable(enabled = !saving && savedDish == null) { save() }.padding(horizontal = 16.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) { HcText(if (saving) t.t("createDish.saving") else t.t("createDish.done"), HcTypeRoles.Body, color = HcColors.White, bold = true) }
        },
    ) {
        Column(
            Modifier.pointerInput(page) {
                // Swipe back: a clear horizontal drag to the right.
                var total = 0f
                detectHorizontalDragGestures(
                    onDragStart = { total = 0f },
                    onDragEnd = { if (total > 160f) goTo(page - 1) },
                ) { _, dx -> total += dx }
            },
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
          if (current == "import") {
            StartOptionTiles(
                listOf(
                    t.t("createDish.modeText") to "paste",
                    t.t("createDish.modeScan") to "scan",
                ),
            ) { target -> sheet = target }
          } else if (current == "title") {
            HcText(t.t("createDish.pageTitle"), HcTypeRoles.Small, color = HcColors.Black, bold = true)
            FoodPillField(details.name, { updateDetails(details.copy(name = it)) }, t.t("createDish.namePlaceholder"), Modifier.fillMaxWidth())
            FoodTextArea(details.description, { updateDetails(details.copy(description = it)) }, placeholder = t.t("createDish.descriptionPlaceholder"), minLines = 5, background = HcColors.Tan, border = false)
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.Tan).padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                HcText(t.t("createDish.durationLabel"), HcTypeRoles.Body, color = HcColors.Black)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PageArrow("Minus", enabled = details.durationMinutes != null) {
                        val d = details.durationMinutes
                        updateDetails(details.copy(durationMinutes = if (d == null || d <= 5) null else maxOf(5, (d + 4) / 5 * 5 - 5)))
                    }
                    HcText(details.durationMinutes?.toString() ?: "0", HcTypeRoles.Body, color = HcColors.Black, bold = true)
                    HcText(t.t("createDish.minutes"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    PageArrow("Plus", enabled = true) {
                        val d = details.durationMinutes ?: 0
                        updateDetails(details.copy(durationMinutes = minOf(5999, d / 5 * 5 + 5)))
                    }
                }
            }
          } else if (current == "ingredients") {

            importNote?.let { note ->
                HcCard {
                    HcText(t.t("createDish.importDone"), HcTypeRoles.Small, color = HcColors.Black, bold = true)
                    note.nutrition?.takeIf { it.isNotEmpty() }?.let { HcText("${t.t("createDish.importNutrition")}: $it", HcTypeRoles.Small, color = HcColors.TextSecondary) }
                    if (note.missing.isNotEmpty()) {
                        HcText(t.t("createDish.importMissing"), HcTypeRoles.Small, Modifier.padding(top = 8.dp), color = HcColors.Black, bold = true)
                        note.missing.forEach { HcText("• $it", HcTypeRoles.Small, Modifier.padding(start = 8.dp), color = HcColors.TextSecondary) }
                    }
                }
            }

            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.Tan).padding(horizontal = 16.dp, vertical = 12.dp)) {
                PersonsSlider(t.t("createDish.servings"), servings ?: 0, RecipePortions.MAX_PERSONS, { servings = if (it > 0) it else null }, min = 0, unset = servings == null, centered = true)
            }

            val searchBringIntoView = remember { BringIntoViewRequester() }
            Column(Modifier.bringIntoViewRequester(searchBringIntoView)) {
                HcText(t.t("createDish.addIngredient"), HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), color = HcColors.Black, bold = true)
                FoodSearchField(query, { value ->
                    query = value
                    if (value.isBlank()) {
                        searchState = "idle"
                        results = emptyList()
                    }
                }, t.t("createDish.searchPlaceholder"), onFocus = { searchScope.launch { delay(50); searchBringIntoView.bringIntoView() } }, trailing = {
                    HcIcon("Barcode", size = 30.dp, color = HcColors.Black, modifier = Modifier.clickable { nav.push("/camera?mode=product&for=ret") })
                })
                if (ingredientError && ingredients.isEmpty()) {
                    HcText(t.t("createDish.ingredientRequired"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(top = 8.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                }
                if (query.isNotBlank()) {
                    FoodListCard(Modifier.padding(top = 8.dp)) {
                        when (searchState) {
                            "loading" -> FoodSkeletonMediaRows(4, Modifier.padding(horizontal = 16.dp))
                            "error" -> HcText(connectionMessage(t, searchError, t.t("createDish.noResults")), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(16.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                            "ready" -> {
                                SearchCorrectionNotice(correction, onSearchInstead = { exactQuery = query }, onUseSuggestion = { query = it }, modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp))
                                if (results.isEmpty()) HcText(t.t("createDish.noResults"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(16.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                                val shown = results
                                shown.forEachIndexed { index, product ->
                                    Row(
                                        Modifier.fillMaxWidth().clickable {
                                            nav.push("/add/${product.id}?for=ret")
                                        }.padding(horizontal = 16.dp, vertical = 12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    ) {
                                        Box(Modifier.size(36.dp)) { if (product.imageUrl != null) FoodImage(product.imageUrl, Modifier.size(36.dp)) }
                                        HcText(product.name, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black, bold = true)
                                    }
                                    if (index < shown.lastIndex) FoodDivider()
                                }
                            }
                        }
                    }
                }
            }

            Column {
                HcText(t.t("createDish.ingredients"), HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), color = HcColors.Black, bold = true)
                if (ingredients.isEmpty()) {
                    HcCard { HcText(t.t("createDish.noIngredientsYet"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center) }
                } else {
                    FoodListCard(radius = 16.dp) {
                        ingredients.forEachIndexed { index, ingredient ->
                            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Box(Modifier.size(36.dp)) { if (ingredient.imageUrl != null) FoodImage(ingredient.imageUrl, Modifier.size(36.dp)) }
                                Column(Modifier.weight(1f)) {
                                    HcText(ingredient.name, HcTypeRoles.Body, color = HcColors.Black, bold = true)
                                    HcText(
                                        if (DishDraft.isPrivateIngredientId(ingredient.productId)) t.t("createDish.kcalUnknown", "grams" to jsNumberText(ingredient.grams))
                                        else t.t("createDish.gramsKcal", "grams" to jsNumberText(ingredient.grams), "kcal" to jsRound(ingredient.kcalPer100g * ingredient.grams / 100)),
                                        HcTypeRoles.Small,
                                        color = HcColors.TextSecondary,
                                    )
                                }
                                FoodRemoveButton(onClick = {
                                    DishDraft.remove(index)
                                    ingredients = DishDraft.read()
                                })
                            }
                            if (index < ingredients.lastIndex) FoodDivider()
                        }
                    }
                }
            }

            if (ingredients.isNotEmpty()) {
                HcCard {
                    HcText(t.t("createDish.total"), HcTypeRoles.Small, color = HcColors.Black, bold = true)
                    HcText(t.t("createDish.gramsKcal", "grams" to jsRound(totalGrams), "kcal" to jsRound(totalKcal)), HcTypeRoles.Body, color = HcColors.Black)
                    HcText(
                        t.t("createDish.macrosSummary", "protein" to jsNumberText(round1(totalProtein)), "carbs" to jsNumberText(round1(totalCarbs)), "fat" to jsNumberText(round1(totalFat))),
                        HcTypeRoles.Small,
                        color = HcColors.TextSecondary,
                    )
                }
            }

          } else if (current.startsWith("step:")) {
            RecipeStepPage(
                index = currentStep,
                step = stepList[currentStep],
                canRemove = stepList.size > 1,
                onChange = { next -> updateDetails(details.copy(steps = stepList.mapIndexed { i, st -> if (i == currentStep) next else st })) },
                onAddAfter = {
                    val at = currentStep
                    updateDetails(details.copy(steps = stepList.take(at + 1) + DishDraftStep() + stepList.drop(at + 1)))
                    page += 1
                },
                onRemove = {
                    updateDetails(details.copy(steps = stepList.filterIndexed { i, _ -> i != currentStep }))
                    page -= 1
                },
            )
          } else {
            Column {
                HcText(t.t("recipeImages.title"), HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), color = HcColors.Black, bold = true)
                RecipeImagesPicker(details.images) { updateDetails(details.copy(images = it)) }
            }
          }
        }
    }

    if (sheet == "paste") PasteTextSheet(onClose = { sheet = "none" }, onResult = ::applyImport)
    if (sheet == "scan") ScanSheet(onClose = { sheet = "none" }, onResult = ::applyImport)
    val dish = savedDish
    if (dish != null && sharePrompt) {
        HcBottomSheet(onDismiss = { answerShare(false) }, title = t.t("createDish.shareQuestionTitle")) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcText(t.t("createDish.shareQuestionBody"), HcTypeRoles.Body, color = HcColors.Black)
                HcButton(t.t("createDish.shareYes"), onClick = { answerShare(true) }, enabled = !sharing)
                HcButton(t.t("createDish.shareNo"), onClick = { answerShare(false) }, kind = HcButtonKind.Secondary)
            }
        }
    }
    if (dish != null && !sharePrompt) RecipeCategoriesSheet(dish.first, dish.second, onClose = ::finish)
}

/** src/components/recipes/RecipeImportSheets.tsx PasteTextSheet. */
@Composable
private fun PasteTextSheet(onClose: () -> Unit, onResult: (ImportResult) -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf("") }
    var working by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }
    HcBottomSheet(
        onDismiss = onClose,
        title = t.t("createDish.pasteTitle"),
        size = HcSheetSize.Full,
        scrollable = true,
        footer = {
            HcButton(
                if (working) t.t("createDish.pasteWorking") else t.t("createDish.pasteInsert"),
                onClick = {
                    working = true
                    error = false
                    scope.launch {
                        try {
                            onResult(parseRecipeText(text))
                            onClose()
                        } catch (_: Exception) {
                            error = true
                            working = false
                        }
                    }
                },
                enabled = !working && text.isNotBlank(),
            )
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (working) {
                FoodSkeletonMediaRows(5)
            } else {
                FoodTextArea(text, { text = it }, placeholder = t.t("createDish.pastePlaceholder"), minLines = 12, background = HcColors.Card, border = false)
                if (error) HcText(t.t("createDish.pasteError"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
        }
    }
}

/** Phone OCR first (printed text); low confidence = handwriting, sent to the server. */
private suspend fun readRecipePage(photo: FoodPhoto): String {
    val local = runCatching { FoodPlatform.recognizeText?.invoke(photo, "dan+eng") }.getOrNull()
    if (local != null) {
        val (text, confidence) = local
        val meaningful = text.count { it.isLetterOrDigit() } >= 4
        if (confidence >= 60 && meaningful && text.trim().length > 40) return text
    }
    return Api.post("/api/dishes/ocr-handwriting", mapOf("image" to photo.dataUrl())).str("text") ?: ""
}

/** src/components/recipes/RecipeImportSheets.tsx ScanSheet — photograph the recipe pages. */
@Composable
private fun ScanSheet(onClose: () -> Unit, onResult: (ImportResult) -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var pages by remember { mutableStateOf<List<FoodPhoto>>(emptyList()) }
    var working by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }
    HcBottomSheet(
        onDismiss = onClose,
        title = t.t("createDish.scanTitle"),
        size = HcSheetSize.Full,
        scrollable = true,
        footer = {
            HcButton(
                if (working) t.t("createDish.scanWorking") else t.t("createDish.scanFinish"),
                onClick = {
                    working = true
                    error = false
                    scope.launch {
                        try {
                            val texts = pages.map { readRecipePage(it) }
                            val result = parseRecipeText(texts.joinToString("\n\n"))
                            val dataUrls = pages.map { it.dataUrl() }
                            onResult(result.copy(image = dataUrls.firstOrNull(), pageImages = dataUrls.drop(1)))
                            onClose()
                        } catch (_: Exception) {
                            error = true
                            working = false
                        }
                    }
                },
                enabled = !working && pages.isNotEmpty(),
            )
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (working) {
                FoodSkeletonMediaRows(5)
            } else {
                HcText(t.t("createDish.scanHint"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FoodTileButton(t.t("createDish.scanTake"), "Camera", {
                        scope.launch { FoodPlatform.photo(fromGallery = false)?.let { pages = pages + it } }
                    }, Modifier.weight(1f))
                    FoodTileButton(t.t("createDish.scanGallery"), "Photo", {
                        scope.launch { pages = pages + FoodPlatform.photos(20) }
                    }, Modifier.weight(1f))
                }
                if (pages.isNotEmpty()) {
                    pages.chunked(3).forEachIndexed { rowIndex, row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEachIndexed { i, page ->
                                val index = rowIndex * 3 + i
                                Box(Modifier.weight(1f).aspectRatio(3f / 4f).clip(RoundedCornerShape(12.dp)).background(HcColors.Tan)) {
                                    FoodImage(page.dataUrl(), Modifier.fillMaxSize(), ContentScale.Crop)
                                    Box(Modifier.align(Alignment.TopEnd).padding(4.dp)) {
                                        FoodRemoveButton(onClick = { pages = pages.filterIndexed { j, _ -> j != index } })
                                    }
                                }
                            }
                            repeat(3 - row.size) { Box(Modifier.weight(1f)) }
                        }
                    }
                }
                if (error) HcText(t.t("createDish.scanError"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
        }
    }
}

/** src/components/recipes/RecipeImagesPicker.tsx — up to 3 photos of the finished dish. */
@Composable
private fun RecipeImagesPicker(images: List<String>, onChange: (List<String>) -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val cells = images.map<String, String?> { it } + if (images.size < MAX_RECIPE_IMAGES) listOf(null) else emptyList()
    cells.chunked(3).forEachIndexed { rowIndex, row ->
        Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEachIndexed { i, image ->
                val index = rowIndex * 3 + i
                Box(Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan)) {
                    if (image != null) {
                        FoodImage(image, Modifier.fillMaxSize(), ContentScale.Crop)
                        Box(Modifier.align(Alignment.TopEnd).padding(4.dp)) { FoodRemoveButton(onClick = { onChange(images.filterIndexed { j, _ -> j != index }) }) }
                    } else {
                        Column(
                            Modifier.fillMaxSize().clickable {
                                scope.launch {
                                    val picked = FoodPlatform.photos(MAX_RECIPE_IMAGES - images.size).map { it.dataUrl() }
                                    if (picked.isNotEmpty()) onChange((images + picked).take(MAX_RECIPE_IMAGES))
                                }
                            },
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
                        ) {
                            HcIcon("Camera", size = 24.dp, color = HcColors.Black)
                            HcText(t.t("recipeImages.count", "count" to images.size, "max" to MAX_RECIPE_IMAGES), HcTypeRoles.Micro, color = HcColors.TextSecondary)
                        }
                    }
                }
            }
            repeat(3 - row.size) { Box(Modifier.weight(1f)) }
        }
    }
}

@Composable
private fun PageArrow(icon: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.size(44.dp).clip(CircleShape).background(HcColors.Tan).alpha(if (enabled) 1f else 0.3f).clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { HcIcon(icon, size = 22.dp, color = HcColors.Black) }
}

/** src/components/recipes/RecipeStepPage.tsx — one recipe step on its own page, photo at the bottom. */
@Composable
private fun RecipeStepPage(
    index: Int,
    step: DishDraftStep,
    canRemove: Boolean,
    onChange: (DishDraftStep) -> Unit,
    onAddAfter: () -> Unit,
    onRemove: () -> Unit,
) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            HcText(t.t("recipeSteps.stepNumber", "number" to index + 1), HcTypeRoles.Small, color = HcColors.TextSecondary, bold = true)
            if (canRemove) FoodRemoveButton(onClick = onRemove, background = HcColors.Tan)
        }
        FoodPillField(
            step.title,
            { onChange(step.copy(title = it)) },
            t.t("recipeSteps.titlePlaceholder"),
            Modifier.fillMaxWidth(),
            background = HcColors.Tan,
            shape = RoundedCornerShape(HcDimens.RadiusCard),
            bold = true,
        )
        FoodTextArea(step.text, { onChange(step.copy(text = it)) }, placeholder = t.t("recipeSteps.textPlaceholder"), minLines = 6, background = HcColors.Tan, border = false)
        Box(
            Modifier.fillMaxWidth().heightIn(min = 128.dp).clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan).clickable {
                scope.launch { FoodPlatform.photo(fromGallery = false)?.let { onChange(step.copy(image = it.dataUrl())) } }
            },
            contentAlignment = Alignment.Center,
        ) {
            val image = step.image
            if (image != null) {
                FoodImage(image, Modifier.fillMaxWidth().heightIn(max = 224.dp), ContentScale.Crop)
                Box(Modifier.align(Alignment.TopEnd).padding(8.dp)) { FoodRemoveButton(onClick = { onChange(step.copy(image = null)) }) }
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(16.dp)) {
                    HcIcon("Camera", size = 24.dp, color = HcColors.Black)
                    HcText(t.t("recipeSteps.dropPhoto"), HcTypeRoles.Small, color = HcColors.TextSecondary, align = TextAlign.Center)
                }
            }
        }
        HcButton(t.t("recipeSteps.addStep"), onClick = onAddAfter, kind = HcButtonKind.Secondary)
    }
}

private val RECIPE_CATEGORY_GROUPS = listOf(
    "diet" to listOf("vegan", "vegetarian", "pescetarian", "glutenFree", "lactoseFree", "keto", "lowSugar"),
    "meal" to listOf("breakfast", "lunch", "dinner", "snack", "dessert"),
    "cuisine" to listOf("danish", "nordic", "italian", "french", "spanish", "greek", "middleEastern", "indian", "asian", "mexican", "american"),
    "method" to listOf("quick", "oven", "stew", "salad", "soup", "grill", "noCook"),
)

/** src/components/recipes/RecipeCategoriesDialog.tsx — categories after saving (diets pre-selected). */
@Composable
private fun RecipeCategoriesSheet(dishId: String, initialTags: List<String>, onClose: () -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var tags by remember { mutableStateOf(initialTags) }
    var busy by remember { mutableStateOf(false) }
    var openGroups by remember { mutableStateOf(setOf("diet")) }

    fun close() {
        if (tags.isEmpty()) {
            onClose()
            return
        }
        busy = true
        scope.launch {
            runCatching { Api.patch("/api/dishes/${encodeUri(dishId)}", mapOf("tags" to tags)) }
            busy = false
            onClose()
        }
    }

    FoodScrollSheet(onDismiss = ::close) {
        HcText(t.t("recipeCategories.intro"), HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), color = HcColors.TextSecondary)
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            RECIPE_CATEGORY_GROUPS.forEach { (group, values) ->
                val count = values.count { "$group:$it" in tags }
                val open = group in openGroups
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.Tan)) {
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp)
                            .let { if (open) it.background(HcColors.SelectedBg) else it }
                            .clickable { openGroups = if (open) openGroups - group else openGroups + group }
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        HcText(t.t("recipeCategories.groups.$group"), HcTypeRoles.Body, Modifier.weight(1f), bold = true)
                        if (count > 0) HcText(count.toString(), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        HcChevron(if (open) ChevronDirection.Down else ChevronDirection.Right)
                    }
                    if (open) {
                        Column(Modifier.fillMaxWidth().background(HcColors.Cream).padding(horizontal = 16.dp)) {
                            values.forEachIndexed { index, value ->
                                val tag = "$group:$value"
                                val label = t.t(if (group == "diet") "recipeFilters.diets.$value" else "recipeCategories.$group.$value")
                                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    HcText(label, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                                    HcToggle(tag in tags, { on -> tags = if (on) tags.filter { it != tag } + tag else tags.filter { it != tag } })
                                }
                                if (index < values.lastIndex) FoodDivider()
                            }
                        }
                    }
                }
            }
        }
        Box(Modifier.padding(top = 16.dp)) {
            HcButton(t.t("recipeCategories.close"), onClick = ::close, enabled = !busy)
        }
    }
}

/** Web: StartOptionTiles in create-dish/page.tsx — horizontal tiles like the Add menu; icon slot left empty. */
@Composable
private fun StartOptionTiles(options: List<Pair<String, String>>, onPick: (String) -> Unit) {
    HcAccordionCard {
        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEach { (label, target) ->
                Column(
                    Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).clickable { onPick(target) }.padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Spacer(Modifier.size(96.dp))
                    HcText(label, HcTypeRoles.Body, color = HcColors.Black, align = TextAlign.Center)
                }
            }
        }
    }
}

package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.HcSearchField
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.max
import kotlin.math.roundToInt

/** src/components/recipes/RecipeRow.tsx RecipeRowData */
internal class RecipeRowData(
    val key: String,
    val href: String,
    val name: String,
    val imageUrl: String?,
    val subtitle: String,
    val label: Pair<String, Boolean>? = null,
    val warnings: List<String> = emptyList(),
    val extra: String? = null,
    /** Click key for "Trender netop nu" (src/lib/recipe-clicks.ts). */
    val clickKey: String? = null,
)

/**
 * src/lib/meal-kit-providers.ts — meal-kit integrations HelloFresh, RetNemt and BetterFeast
 * (docs/DECISIONS.md 2026-10-10): i18n keys for the source button, the row label and the
 * integrations card.
 */
internal class MealKitProvider(
    val key: String,
    val idPrefix: String,
    val sourceLabel: String,
    val rowLabel: String,
    val title: String,
    val description: String,
)

internal val MEAL_KIT_PROVIDERS = listOf(
    MealKitProvider("hellofresh", "hf_", "recipes.sourceHelloFresh", "recipes.helloFresh", "integrations.helloFreshTitle", "integrations.helloFreshDescription"),
    MealKitProvider("retnemt", "rn_", "recipes.sourceRetnemt", "recipes.retnemt", "integrations.retNemtTitle", "integrations.retNemtDescription"),
    MealKitProvider("betterfeast", "bf_", "recipes.sourceBetterfeast", "recipes.betterfeast", "integrations.betterFeastTitle", "integrations.betterFeastDescription"),
)

/** parseRecipeProviders: User.recipeProviders from /api/profile — known keys only, fixed order. */
internal fun parseRecipeProviders(user: JsonObject?): List<String> {
    val list = (user?.get("recipeProviders") as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.orEmpty()
    return MEAL_KIT_PROVIDERS.map { it.key }.filter { it in list }
}

/** Meal-kit dishes (id "hf_…", "rn_…", "bf_…") have their own page (docs/DECISIONS.md 2026-09-27, 2026-10-10). */
internal fun recipeHref(id: String) =
    if (MEAL_KIT_PROVIDERS.any { id.startsWith(it.idPrefix) }) "/profile/recipes/hellofresh/${Location.encode(id)}"
    else "/profile/recipes/${Location.encode(id)}?kind=shared"

/** favoriteKcalText: a BetterFeast favourite without serving weight shows kcal per 100 g. */
private fun favoriteKcalText(t: Translator, kcal: Double, per100g: Boolean): String =
    // A recipe is never shown with "0 kcal" (user rule 2026-10-11): 0 or unknown energy shows no kcal text.
    if (kcal.roundToInt() <= 0) ""
    else if (per100g) t.t("recipeFilters.kcalPer100g", "kcal" to kcal.roundToInt())
    else t.t("recipes.kcalTotal", "kcal" to kcal.roundToInt())

/** RecipeRow: image (or soup icon), name, warnings, subtitle + label, extra, chevron. */
@Composable
internal fun RecipeRow(row: RecipeRowData, divider: Boolean = true) {
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    Column {
        Row(
            Modifier.fillMaxWidth().clickable { trackRecipeClick(scope, row.clickKey); nav.push(row.href) }.padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val shape = RoundedCornerShape(HcDimens.RadiusCard)
            Box(Modifier.size(44.dp).clip(shape).background(HcColors.Tan, shape), contentAlignment = Alignment.Center) {
                if (row.imageUrl != null) HcRemoteImage(row.imageUrl, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else HcIcon("Soup", size = 20.dp, color = HcColors.Black, modifier = Modifier.alpha(0.5f))
            }
            Column(Modifier.weight(1f)) {
                HcText(row.name, HcTypeRoles.Body, bold = true, color = HcColors.Black, maxLines = 1)
                row.warnings.forEach { HcText(it, HcTypeRoles.Small, color = HcColors.RedDark) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (row.subtitle.isNotEmpty()) HcText(row.subtitle, HcTypeRoles.Small, color = HcColors.TextSecondary)
                    row.label?.let { (text, green) -> HcText(text, HcTypeRoles.Small, bold = true, color = if (green) HcColors.Green else HcColors.Black) }
                }
                row.extra?.let { HcText(it, HcTypeRoles.Small, color = HcColors.TextSecondary) }
            }
            HcIcon("ChevronRight", size = 18.dp, color = HcColors.Black)
        }
        if (divider) HcLine()
    }
}

/** src/lib/recipe-clicks.ts — tell the server a dish was opened; errors are ignored. */
private fun trackRecipeClick(scope: CoroutineScope, key: String?) {
    if (key == null) return
    scope.launch { runCatching { Api.post("/api/recipe-clicks", mapOf("key" to key)) } }
}

/** src/components/recipes/RecipeRow.tsx RecipeCard — image over name and subtitle, in the "Trender netop nu" slider. */
@Composable
private fun RecipeCard(row: RecipeRowData, modifier: Modifier = Modifier.width(144.dp)) {
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(modifier.clickable { trackRecipeClick(scope, row.clickKey); nav.push(row.href) }) {
        Box(Modifier.fillMaxWidth().aspectRatio(1f).clip(shape).background(HcColors.Tan, shape), contentAlignment = Alignment.Center) {
            if (row.imageUrl != null) HcRemoteImage(row.imageUrl, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            else HcIcon("Soup", size = 32.dp, color = HcColors.Black, modifier = Modifier.alpha(0.5f))
        }
        HcText(row.name, HcTypeRoles.Small, Modifier.padding(top = 8.dp), bold = true, color = HcColors.Black, maxLines = 2)
        if (row.subtitle.isNotEmpty()) HcText(row.subtitle, HcTypeRoles.Small, color = HcColors.TextSecondary)
    }
}

@Composable
private fun RecipeRows(rows: List<RecipeRowData>) {
    Column { rows.forEachIndexed { index, row -> RecipeRow(row, divider = index < rows.lastIndex) } }
}

@Composable
private fun StatusText(text: String) {
    HcText(text, HcTypeRoles.Body, Modifier.fillMaxWidth().padding(vertical = 8.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
}

/** Native port of src/app/profile/recipes/page.tsx — tabs "Mine retter" and "Delte retter". */
@Composable
fun RecipesScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val tab = if (args.opt("tab") == "mine") "mine" else "shared"

    HcScreen(title = t.t("recipes.title"), contentPadding = PaddingValues(0.dp)) {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 12.dp), horizontalArrangement = Arrangement.End) {
            Row(
                Modifier.clickable { nav.push("/create-dish") }.padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                HcIcon("Plus", size = 16.dp, color = HcColors.Black)
                HcText(t.t("recipes.createNew"), HcTypeRoles.Small, bold = true, underline = true, color = HcColors.Black)
            }
        }
        Row(Modifier.fillMaxWidth()) {
            listOf("mine", "shared").forEach { value ->
                val selected = tab == value
                Column(Modifier.weight(1f).clickable { nav.replace("/profile/recipes?tab=$value") }) {
                    HcText(
                        t.t(if (value == "mine") "recipes.tabMine" else "recipes.tabShared"),
                        HcTypeRoles.Small,
                        Modifier.fillMaxWidth().padding(vertical = 12.dp).alpha(if (selected) 1f else 0.6f),
                        bold = true,
                        color = HcColors.Black,
                        align = TextAlign.Center,
                    )
                    Box(Modifier.fillMaxWidth().height(2.dp).background(if (selected) HcColors.Black else HcColors.TanDark))
                }
            }
        }
        Column(Modifier.padding(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)) {
            if (tab == "mine") MineTab(t) else SharedTab(t)
        }
    }
}

@Serializable
private data class DishIngredientProduct(val kcalPer100g: Double = 0.0)

@Serializable
private data class DishIngredient(val grams: Double = 0.0, val product: DishIngredientProduct = DishIngredientProduct())

@Serializable
private data class OwnDishSummary(
    val id: String,
    val name: String,
    val sharedRecipeId: String? = null,
    val shareRejected: Boolean = false,
    val images: List<String> = emptyList(),
    val ingredients: List<DishIngredient> = emptyList(),
)

@Serializable
private data class DishesResponse(val dishes: List<OwnDishSummary> = emptyList())

@Serializable
private data class FavoriteRecipe(val id: String, val name: String, val kcal: Double = 0.0, val per100g: Boolean = false, val images: List<String> = emptyList())

@Serializable
private data class FavoritesResponse(val favorites: List<FavoriteRecipe> = emptyList())

@Composable
private fun MineTab(t: Translator) {
    val nav = LocalNavigator.current
    var rows by remember { mutableStateOf<List<RecipeRowData>>(emptyList()) }
    var state by remember { mutableStateOf("loading") }

    LaunchedEffect(Unit) {
        try {
            coroutineScope {
                val dishesJob = async { ApiJson.decodeFromJsonElement(DishesResponse.serializer(), Api.get("/api/dishes")).dishes }
                val favoritesJob = async {
                    runCatching { ApiJson.decodeFromJsonElement(FavoritesResponse.serializer(), Api.get("/api/recipe-favorites")).favorites }.getOrDefault(emptyList())
                }
                val dishes = dishesJob.await()
                val favorites = favoritesJob.await()
                rows = dishes.map { dish ->
                    val kcal = dish.ingredients.sumOf { it.product.kcalPer100g * it.grams / 100 }.roundToInt()
                    RecipeRowData(
                        key = "own-${dish.id}",
                        href = "/profile/recipes/${Location.encode(dish.id)}?kind=own",
                        name = dish.name,
                        imageUrl = dish.images.firstOrNull(),
                        subtitle = if (kcal > 0) t.t("recipes.kcalTotal", "kcal" to kcal) else "",
                        label = when {
                            dish.sharedRecipeId != null -> t.t("recipes.statusShared") to true
                            dish.shareRejected -> t.t("recipes.statusNotShared") to false
                            else -> t.t("recipes.statusPrivate") to false
                        },
                    )
                } + favorites.map { recipe ->
                    RecipeRowData(
                        key = "fav-${recipe.id}",
                        href = recipeHref(recipe.id),
                        name = recipe.name,
                        imageUrl = null,
                        subtitle = favoriteKcalText(t, recipe.kcal, recipe.per100g),
                        label = t.t("recipes.statusFavorite") to false,
                    )
                }
            }
            state = "ready"
        } catch (e: Exception) {
            state = "error"
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
        when {
            state == "loading" -> HcLoader()
            state == "error" -> StatusText(t.t("recipes.loadError"))
            rows.isEmpty() -> StatusText(t.t("recipes.mineEmpty"))
            else -> RecipeRows(rows)
        }
        HcButton(t.t("recipes.createDish"), onClick = { nav.push("/create-dish") }, kind = HcButtonKind.Secondary)
    }
}

@Serializable
private data class Split(val protein: Double = 0.0, val carbs: Double = 0.0, val fat: Double = 0.0)

@Serializable
private data class Warning(val ingredient: String, val allergen: String)

@Serializable
private data class SearchResult(
    val kind: String,
    val id: String,
    val name: String,
    val imageUrl: String? = null,
    val kcal: Double = 0.0,
    val per100g: Boolean = false,
    val servings: Int = 1,
    val split: Split? = null,
    val warnings: List<Warning> = emptyList(),
)

@Serializable
private data class SearchResponse(val recipes: List<SearchResult> = emptyList(), val hasMore: Boolean = false)

/** "Alle retter" (user rule 2026-10-17): three grid rows per page, more on scroll. */
private const val ALL_ROWS_PER_PAGE = 3

/** Same breakpoints as columnsFor in src/app/profile/recipes/page.tsx (2 on phones). */
private fun columnsFor(widthDp: Float) = when {
    widthDp >= 720f -> 4
    widthDp >= 480f -> 3
    else -> 2
}

private class AllPage(val key: String, val recipes: List<SearchResult>, val hasMore: Boolean, val error: Boolean)

/** Horizontal one-line slider of recipe cards (Trender netop nu, favourites). */
@Composable
private fun RecipeSlider(rows: List<RecipeRowData>) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) { rows.forEach { RecipeCard(it) } }
}

@Composable
private fun SharedTab(t: Translator) {
    val nav = LocalNavigator.current
    var query by remember { mutableStateOf("") }
    var filters by remember { mutableStateOf(RecipeFilters.load()) }
    var filterSheetOpen by remember { mutableStateOf(false) }
    var source by remember { mutableStateOf("all") }
    var providers by remember { mutableStateOf<List<String>?>(null) }
    var isSerious by remember { mutableStateOf<Boolean?>(null) }
    var results by remember { mutableStateOf<List<SearchResult>>(emptyList()) }
    var state by remember { mutableStateOf("loading") }
    var favorites by remember { mutableStateOf<List<FavoriteRecipe>?>(null) }
    val searching = query.isNotBlank()
    var allPage by remember { mutableStateOf(AllPage("", emptyList(), hasMore = false, error = false)) }
    var allLoading by remember { mutableStateOf(false) }
    var gridColumns by remember { mutableStateOf(2) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        providers = parseRecipeProviders(loadProfileUser())
        favorites = runCatching { ApiJson.decodeFromJsonElement(FavoritesResponse.serializer(), Api.get("/api/recipe-favorites")).favorites }.getOrDefault(emptyList())
    }
    // Filters/sorting and the meal kits are Seriøs-only (docs/DECISIONS.md 2026-09-26).
    LaunchedEffect(Unit) {
        val tier = runCatching { (Api.get("/api/subscription") as? JsonObject)?.get("tier")?.jsonPrimitive?.contentOrNull }.getOrNull() ?: "FREE"
        isSerious = tier == "SERIOUS"
    }

    // Without a search: the most popular dishes ("Trender netop nu"); with a search: results.
    LaunchedEffect(query, filters, providers, isSerious, source) {
        val enabled = providers ?: return@LaunchedEffect
        val serious = isSerious ?: return@LaunchedEffect
        delay(200)
        state = "loading"
        try {
            val params = (if (serious) filters.toParams() else listOf("sort" to "relevance")).toMutableList()
            if (query.isNotBlank()) params += "q" to query.trim()
            else {
                params.removeAll { it.first == "sort" }
                params += "trending" to "1"
            }
            if (enabled.isNotEmpty() && serious) params += "providers" to enabled.joinToString(",")
            if (source != "all") params += "source" to source
            results = ApiJson.decodeFromJsonElement(SearchResponse.serializer(), Api.get("/api/shared-recipes?${queryString(params)}")).recipes
            state = "ready"
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            state = "error"
        }
    }

    // "Alle retter": same parameters as Trender without trending; the key changes with filters/source.
    val allKey: String = run {
        val enabled = providers ?: return@run ""
        val serious = isSerious ?: return@run ""
        val params = (if (serious) filters.toParams() else listOf("sort" to "relevance")).toMutableList()
        if (enabled.isNotEmpty() && serious) params += "providers" to enabled.joinToString(",")
        if (source != "all") params += "source" to source
        queryString(params)
    }
    val allCurrent = allKey.isNotEmpty() && allPage.key == allKey
    val latestAllKey by rememberUpdatedState(allKey)

    fun loadMoreAll(key: String, offset: Int) {
        if (key.isEmpty() || allLoading) return
        allLoading = true
        scope.launch {
            try {
                val limit = ALL_ROWS_PER_PAGE * gridColumns
                val page = ApiJson.decodeFromJsonElement(SearchResponse.serializer(), Api.get("/api/shared-recipes?$key&offset=$offset&limit=$limit"))
                // A reply for old filters is dropped.
                if (latestAllKey != key) return@launch
                val current = allPage
                allPage = AllPage(key, if (offset == 0 || current.key != key) page.recipes else current.recipes + page.recipes, page.hasMore, error = false)
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                if (latestAllKey == key) allPage = AllPage(key, if (allPage.key == key) allPage.recipes else emptyList(), hasMore = false, error = true)
            } finally {
                allLoading = false
            }
        }
    }

    LaunchedEffect(allKey) {
        if (allKey.isEmpty()) return@LaunchedEffect
        delay(200)
        allLoading = false
        loadMoreAll(allKey, 0)
    }

    val sourceOptions = buildList {
        add("all" to t.t("recipes.sourceAll"))
        MEAL_KIT_PROVIDERS.filter { providers?.contains(it.key) == true }.forEach { add(it.key to t.t(it.sourceLabel)) }
        add("valdemarsro" to t.t("recipes.sourceValdemarsro"))
    }

    fun subtitleFor(result: SearchResult): String {
        if (!filters.showKcal) return ""
        val perServing = (result.kcal / max(1, result.servings)).roundToInt()
        // Never "0 kcal" (see favoriteKcalText); the server does not send such recipes either.
        if (result.kcal.roundToInt() <= 0 || perServing <= 0) return ""
        if (result.per100g) return t.t("recipeFilters.kcalPer100g", "kcal" to result.kcal.roundToInt())
        return if (result.kind == "shared" && result.servings > 1)
            "${t.t("recipeFilters.kcalPerServing", "kcal" to perServing)} · ${t.t("recipeFilters.servings", "count" to result.servings)}"
        else t.t("recipeFilters.kcalPerServing", "kcal" to perServing)
    }

    fun rowFor(result: SearchResult): RecipeRowData {
        val warnings = result.warnings.map { w ->
            t.t("recipeFilters.warning", "ingredient" to w.ingredient.lowercase(), "allergen" to t.t("recipeFilters.allergens.${w.allergen}").lowercase())
        }
        val split = result.split
        val extra = if (filters.showEnergySplit && split != null)
            t.t("recipeFilters.split", "protein" to jsNumber(split.protein), "carbs" to jsNumber(split.carbs), "fat" to jsNumber(split.fat)) else null
        val clickKey = (if (result.kind == "shared") "shared" else "hf") + ":" + result.id
        return if (result.kind != "shared") RecipeRowData(
            key = result.id,
            clickKey = clickKey,
            // Valdemarsro dishes open as the product page; the meal kits have their own view.
            href = if (result.kind == "valdemarsro") "/add/${Location.encode(result.id)}" else recipeHref(result.id),
            name = result.name,
            imageUrl = result.imageUrl,
            subtitle = subtitleFor(result),
            label = (MEAL_KIT_PROVIDERS.firstOrNull { it.key == result.kind }?.let { t.t(it.rowLabel) } ?: t.t("recipes.valdemarsroSource")) to true,
            warnings = warnings,
            extra = extra,
        ) else RecipeRowData(
            key = result.id,
            clickKey = clickKey,
            href = "/profile/recipes/${Location.encode(result.id)}?kind=shared",
            name = result.name,
            imageUrl = result.imageUrl,
            subtitle = subtitleFor(result),
            warnings = warnings,
            extra = extra,
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HcSearchField(query, { query = it }, t.t("recipes.sharedSearchPlaceholder"), Modifier.weight(1f))
            if (isSerious == false) {
                Box(Modifier.height(48.dp).clickable { nav.push("/profile/subscription/serious") }, contentAlignment = Alignment.Center) {
                    PremiumBadge(t)
                }
            } else {
                Box(Modifier.size(40.dp, 48.dp).clickable { filterSheetOpen = true }, contentAlignment = Alignment.Center) {
                    HcIcon("AdjustmentsHorizontal", size = 26.dp, color = HcColors.Black)
                    if (filters.activeCount > 0) {
                        Box(Modifier.align(Alignment.TopEnd).offset(x = (-2).dp, y = 10.dp).size(8.dp).clip(CircleShape).background(HcColors.Green))
                    }
                }
            }
        }

        // Integrations under the search field: "Opskrifter" shows all, the others only their own.
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            sourceOptions.forEach { (value, label) ->
                val selected = source == value
                val shape = RoundedCornerShape(50)
                Box(
                    Modifier.clip(shape).background(if (selected) HcColors.Black else HcColors.White, shape).border(1.dp, HcColors.Black, shape)
                        .clickable { source = value }.padding(horizontal = 16.dp, vertical = 8.dp),
                ) {
                    HcText(label, HcTypeRoles.Small, bold = true, color = if (selected) HcColors.White else HcColors.Black)
                }
            }
        }

        if (searching) {
            when {
                state == "loading" -> HcLoader()
                state == "error" -> StatusText(t.t("recipes.loadError"))
                results.isEmpty() -> StatusText(t.t("recipes.noResults"))
                else -> RecipeRows(results.map(::rowFor))
            }
        } else {
            if (filters.showTrending) {
                HcSectionTitle(t.t("recipes.trendingTitle"))
                when {
                    state == "loading" -> HcLoader()
                    state == "error" -> StatusText(t.t("recipes.loadError"))
                    results.isEmpty() -> StatusText(t.t("recipes.trendingEmpty"))
                    else -> RecipeSlider(results.map(::rowFor))
                }
            }

            // Favourites on one line like Trender (user rule 2026-10-17).
            if (filters.showFavorites) {
                HcSectionTitle(t.t("recipes.favoritesTitle"))
                val favs = favorites
                when {
                    favs == null -> HcLoader()
                    favs.isEmpty() -> StatusText(t.t("recipes.favoritesEmpty"))
                    else -> RecipeSlider(favs.map { recipe ->
                        RecipeRowData(
                            key = recipe.id,
                            href = recipeHref(recipe.id),
                            name = recipe.name,
                            imageUrl = recipe.images.firstOrNull(),
                            subtitle = favoriteKcalText(t, recipe.kcal, recipe.per100g),
                        )
                    })
                }
            }

            HcSectionTitle(t.t("recipes.allTitle"))
            val allRecipes = if (allCurrent) allPage.recipes else emptyList()
            when {
                !allCurrent -> HcLoader()
                allPage.error && allRecipes.isEmpty() -> StatusText(t.t("recipes.loadError"))
                allRecipes.isEmpty() -> StatusText(t.t("recipes.allEmpty"))
                else -> BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val columns = columnsFor(maxWidth.value)
                    LaunchedEffect(columns) { gridColumns = columns }
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        allRecipes.map(::rowFor).chunked(columns).forEach { line ->
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                line.forEach { RecipeCard(it, Modifier.weight(1f)) }
                                repeat(columns - line.size) { Box(Modifier.weight(1f)) }
                            }
                        }
                    }
                }
            }
            if (allCurrent && allPage.hasMore) {
                // Endless scroll: load the next three rows when this marker nears the bottom of the window.
                val windowHeight = LocalWindowInfo.current.containerSize.height
                Box(
                    Modifier.fillMaxWidth().height(1.dp).onGloballyPositioned { coords ->
                        if (coords.boundsInWindow().top < windowHeight * 1.5f) loadMoreAll(allKey, allPage.recipes.size)
                    },
                )
                if (allLoading) HcLoader()
            }
        }
    }

    if (filterSheetOpen) {
        HcBottomSheet(onDismiss = { filterSheetOpen = false }, title = t.t("recipes.filtersSheetTitle"), size = HcSheetSize.Full) {
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = 16.dp)) {
                RecipeFiltersBody(onChange = { filters = it })
            }
        }
    }
}

/** PremiumGate.tsx PremiumBadge — tan pill with a lock and "Seriøs". */
@Composable
internal fun PremiumBadge(t: Translator) {
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(HcColors.Tan).padding(horizontal = 8.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        HcIcon("Lock", size = 12.dp, color = HcColors.Black)
        HcText(t.t("premium.badge"), HcTypeRoles.Caption)
    }
}

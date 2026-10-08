package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
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
import dk.packroff.hellocal.ui.CaptureLine
import dk.packroff.hellocal.ui.CaptureSearchField
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
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
)

/** HelloFresh recipes (id "hf_…") have their own page (docs/DECISIONS.md 2026-09-27). */
internal fun recipeHref(id: String) =
    if (id.startsWith("hf_")) "/profile/recipes/hellofresh/${Location.encode(id)}" else "/profile/recipes/${Location.encode(id)}?kind=shared"

/** RecipeRow: image (or soup icon), name, warnings, subtitle + label, extra, chevron. */
@Composable
internal fun RecipeRow(row: RecipeRowData, divider: Boolean = true) {
    val nav = LocalNavigator.current
    Column {
        Row(
            Modifier.fillMaxWidth().clickable { nav.push(row.href) }.padding(vertical = 10.dp),
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
        if (divider) CaptureLine()
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
            Box(
                Modifier.clip(RoundedCornerShape(50)).background(HcColors.Green).clickable { nav.push("/create-dish") }.padding(horizontal = 16.dp, vertical = 8.dp),
            ) {
                HcText(t.t("recipes.createNew"), HcTypeRoles.Small, bold = true, color = HcColors.White)
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
private data class FavoriteRecipe(val id: String, val name: String, val kcal: Double = 0.0, val images: List<String> = emptyList())

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
                        subtitle = t.t("recipes.kcalTotal", "kcal" to kcal),
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
                        subtitle = t.t("recipes.kcalTotal", "kcal" to recipe.kcal.roundToInt()),
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
    val servings: Int = 1,
    val split: Split? = null,
    val warnings: List<Warning> = emptyList(),
)

@Serializable
private data class SearchResponse(val recipes: List<SearchResult> = emptyList())

private const val TRENDING_COUNT = 3

@Composable
private fun SharedTab(t: Translator) {
    val nav = LocalNavigator.current
    var query by remember { mutableStateOf("") }
    var filters by remember { mutableStateOf(RecipeFilters.load()) }
    var filterSheetOpen by remember { mutableStateOf(false) }
    var source by remember { mutableStateOf("all") }
    var helloFresh by remember { mutableStateOf<Boolean?>(null) }
    var isSerious by remember { mutableStateOf<Boolean?>(null) }
    var results by remember { mutableStateOf<List<SearchResult>>(emptyList()) }
    var state by remember { mutableStateOf("loading") }
    var favorites by remember { mutableStateOf<List<FavoriteRecipe>?>(null) }
    val searching = query.isNotBlank()

    LaunchedEffect(Unit) {
        helloFresh = loadProfileUser()?.get("helloFreshEnabled")?.jsonPrimitive?.booleanOrNull ?: false
        favorites = runCatching { ApiJson.decodeFromJsonElement(FavoritesResponse.serializer(), Api.get("/api/recipe-favorites")).favorites }.getOrDefault(emptyList())
    }
    // Filters/sorting and HelloFresh are Seriøs-only (docs/DECISIONS.md 2026-09-26).
    LaunchedEffect(Unit) {
        val tier = runCatching { (Api.get("/api/subscription") as? JsonObject)?.get("tier")?.jsonPrimitive?.contentOrNull }.getOrNull() ?: "FREE"
        isSerious = tier == "SERIOUS"
    }

    // Without a search: the most popular dishes ("Trender netop nu"); with a search: results.
    LaunchedEffect(query, filters, helloFresh, isSerious, source) {
        val hf = helloFresh ?: return@LaunchedEffect
        val serious = isSerious ?: return@LaunchedEffect
        delay(200)
        state = "loading"
        try {
            val params = (if (serious) filters.toParams() else listOf("sort" to "relevance")).toMutableList()
            if (query.isNotBlank()) params += "q" to query.trim()
            else {
                params.removeAll { it.first == "sort" }
                params += "sort" to "popular"
            }
            if (hf && serious) params += "hellofresh" to "1"
            if (source != "all") params += "source" to source
            results = ApiJson.decodeFromJsonElement(SearchResponse.serializer(), Api.get("/api/shared-recipes?${queryString(params)}")).recipes
            state = "ready"
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            state = "error"
        }
    }

    val sourceOptions = buildList {
        add("all" to t.t("recipes.sourceAll"))
        add("shared" to t.t("recipes.sourceShared"))
        if (helloFresh == true) add("hellofresh" to t.t("recipes.sourceHelloFresh"))
        add("valdemarsro" to t.t("recipes.sourceValdemarsro"))
    }

    fun subtitleFor(result: SearchResult): String {
        if (!filters.showKcal) return ""
        val perServing = (result.kcal / max(1, result.servings)).roundToInt()
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
        return if (result.kind != "shared") RecipeRowData(
            key = result.id,
            // Valdemarsro dishes open as the product page; HelloFresh has its own view.
            href = if (result.kind == "valdemarsro") "/add/${Location.encode(result.id)}" else recipeHref(result.id),
            name = result.name,
            imageUrl = result.imageUrl,
            subtitle = subtitleFor(result),
            label = (if (result.kind == "valdemarsro") t.t("recipes.valdemarsroSource") else t.t("recipes.helloFresh")) to true,
            warnings = warnings,
            extra = extra,
        ) else RecipeRowData(
            key = result.id,
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
            CaptureSearchField(query, { query = it }, t.t("recipes.sharedSearchPlaceholder"), Modifier.weight(1f))
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
            HcSectionTitle(t.t("recipes.trendingTitle"))
            val trending = results.take(TRENDING_COUNT)
            when {
                state == "loading" -> HcLoader()
                state == "error" -> StatusText(t.t("recipes.loadError"))
                trending.isEmpty() -> StatusText(t.t("recipes.trendingEmpty"))
                else -> RecipeRows(trending.map(::rowFor))
            }

            HcSectionTitle(t.t("recipes.favoritesTitle"))
            val favs = favorites
            when {
                favs == null -> HcLoader()
                favs.isEmpty() -> StatusText(t.t("recipes.favoritesEmpty"))
                else -> RecipeRows(favs.map { recipe ->
                    RecipeRowData(
                        key = recipe.id,
                        href = recipeHref(recipe.id),
                        name = recipe.name,
                        imageUrl = recipe.images.firstOrNull(),
                        subtitle = t.t("recipes.kcalTotal", "kcal" to recipe.kcal.roundToInt()),
                    )
                })
            }
        }
    }

    if (filterSheetOpen) {
        HcBottomSheet(onDismiss = { filterSheetOpen = false }, title = t.t("recipes.filtersSheetTitle")) {
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

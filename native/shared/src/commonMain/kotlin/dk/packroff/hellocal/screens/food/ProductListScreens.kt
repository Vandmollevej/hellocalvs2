package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.rotate
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.api.OfflineCache
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FoodDivider
import dk.packroff.hellocal.ui.FoodImage
import dk.packroff.hellocal.ui.FoodListCard
import dk.packroff.hellocal.ui.FoodProductResult
import dk.packroff.hellocal.ui.FoodProductResultRow
import dk.packroff.hellocal.ui.FoodSearchField
import dk.packroff.hellocal.ui.FoodSkeletonMediaRows
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

internal val LIST_PAGE_PADDING = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)

/** Favourite toggling shared by Søg, Favoritter, Indscanninger (POST/DELETE /api/favorites). */
internal suspend fun setFavorite(productId: String, next: Boolean) {
    runCatching {
        if (next) Api.post("/api/favorites", mapOf("productId" to productId)) else Api.delete("/api/favorites", mapOf("productId" to productId))
    }
}

internal suspend fun loadFavoriteProducts(): List<FoodProductResult> =
    ApiJson.decodeFromJsonElement(FavoritesResponse.serializer(), Api.get("/api/favorites")).favorites
        .mapNotNull { f -> f.product?.let { FoodProductResult(it.id, it.name, it.imageUrl) } }

@Composable
internal fun ProductResultList(
    items: List<FoodProductResult>,
    favoriteIds: Set<String>,
    t: Translator,
    showKcal: Boolean,
    onOpen: (String) -> Unit,
    onToggleFavorite: (String, Boolean) -> Unit,
) {
    items.forEachIndexed { index, r ->
        FoodProductResultRow(
            result = r,
            kcalText = when {
                !showKcal -> null
                r.nutritionMissing -> t.t("addProduct.nutritionUnknown")
                r.kcal != null -> t.t("foods.kcalPer100g", "kcal" to jsRound(r.kcal))
                else -> null
            },
            isFavorite = r.id in favoriteIds,
            favoriteLabel = t.t(if (r.id in favoriteIds) "search.removeFavorite" else "search.addFavorite"),
            onOpen = onOpen,
            onToggleFavorite = onToggleFavorite,
            divider = index < items.lastIndex,
        )
    }
}

/** Højst tre rækker pr. liste, til brugeren folder hele listen ud (som på weben). */
private const val COLLAPSED_ROWS = 3
private const val RECENT_LIMIT = 30

/** Native port of src/app/search/page.tsx — Søg: favourites, recently added, live results. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SearchScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val forDish = args.opt("for") == "ret"
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<FoodProductResult>>(emptyList()) }
    var resultsState by remember { mutableStateOf("loading") }
    var resultsError by remember { mutableStateOf<Throwable?>(null) }
    var fromCache by remember { mutableStateOf(false) }
    var correction by remember { mutableStateOf(SearchCorrection()) }
    var exactQuery by remember { mutableStateOf<String?>(null) }
    var recentlyAdded by remember { mutableStateOf<List<FoodProductResult>>(emptyList()) }
    var favorites by remember { mutableStateOf<List<FoodProductResult>>(emptyList()) }
    val favoriteIds = favorites.map { it.id }.toSet()
    var favoritesOpen by remember { mutableStateOf(false) }
    var recentOpen by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    fun openProduct(productId: String) = nav.push("/add/$productId${if (forDish) "?for=ret" else ""}")

    fun toggleFavorite(productId: String, next: Boolean) {
        if (next) {
            if (favorites.none { it.id == productId }) {
                (results + recentlyAdded).firstOrNull { it.id == productId }?.let { favorites = favorites + it }
            }
        } else {
            favorites = favorites.filter { it.id != productId }
        }
        scope.launch { setFavorite(productId, next) }
    }

    LaunchedEffect(query, exactQuery) {
        if (query.isBlank()) return@LaunchedEffect
        val exact = exactQuery == query
        correction = SearchCorrection()
        delay(200)
        resultsState = "loading"
        try {
            val data = ApiJson.decodeFromJsonElement(ProductListResponse.serializer(), Api.get("/api/products?q=${encodeUri(query)}${if (exact) "&exact=1" else ""}"))
            correction = SearchCorrection.of(data)
            results = data.products.map {
                FoodProductResult(it.id, it.name, it.imageUrl, it.brand?.name, it.kcalPer100g, !it.nutritionMissing && hasEstimatedMacros(it.nutrientSources), it.nutritionMissing)
            }
            if (!exact && !correction.isActive()) OfflineCache.saveSearch(query, results)
            fromCache = false
            resultsState = "ready"
        } catch (e: Exception) {
            // No connection: show saved results from earlier searches.
            correction = SearchCorrection()
            val cached = OfflineCache.findSearch(query)
            if (cached != null) {
                results = cached
                fromCache = true
                resultsState = "ready"
            } else {
                fromCache = false
                resultsError = e
                resultsState = "error"
                results = emptyList()
            }
        }
    }

    LaunchedEffect(Unit) {
        recentlyAdded = runCatching {
            val regs = ApiJson.decodeFromJsonElement(RegistrationsResponse.serializer(), Api.get("/api/registrations")).registrations
            val seen = mutableSetOf<String>()
            val recent = mutableListOf<FoodProductResult>()
            for (r in regs) {
                val pid = r.productId ?: continue
                if (!seen.add(pid)) continue
                recent += FoodProductResult(pid, r.titleSnapshot, r.product?.imageUrl)
                if (recent.size >= RECENT_LIMIT) break
            }
            recent.toList().also { OfflineCache.saveRecent(it) }
        }.getOrElse { OfflineCache.recent() }
    }

    LaunchedEffect(Unit) {
        favorites = runCatching { loadFavoriteProducts().also { OfflineCache.saveFavorites(it) } }.getOrElse { OfflineCache.favorites() }
    }

    val showFavorites = query.isBlank() && favorites.isNotEmpty()
    val showRecent = query.isBlank() && recentlyAdded.isNotEmpty()

    HcScreen(t.t("search.title"), scroll = false, contentPadding = PaddingValues(0.dp)) {
        Box(Modifier.fillMaxWidth().padding(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceBlock)) {
            FoodSearchField(query, { query = it }, t.t("search.searchPlaceholder"))
        }
        if (query.isBlank()) {
            // Fast søgefelt; listerne ruller under det, og overskrifterne klistrer til toppen,
            // så en udfoldet liste altid kan foldes sammen igen.
            val favHeaderIndex = 0
            val recentHeaderIndex = if (showFavorites) 1 + (if (favoritesOpen) favorites.size else minOf(favorites.size, COLLAPSED_ROWS)) else 0
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, bottom = HcDimens.SpaceSection),
            ) {
                if (showFavorites) {
                    searchSection(
                        title = t.t("search.favorites"),
                        items = favorites,
                        open = favoritesOpen,
                        onToggle = { favoritesOpen = !favoritesOpen; scope.launch { listState.animateScrollToItem(favHeaderIndex) } },
                        favoriteIds = favoriteIds, t = t, onOpen = ::openProduct, onToggleFavorite = ::toggleFavorite,
                    )
                }
                if (showRecent) {
                    searchSection(
                        title = t.t("search.recentlyAdded"),
                        items = recentlyAdded,
                        open = recentOpen,
                        onToggle = { recentOpen = !recentOpen; scope.launch { listState.animateScrollToItem(recentHeaderIndex) } },
                        favoriteIds = favoriteIds, t = t, onOpen = ::openProduct, onToggleFavorite = ::toggleFavorite,
                    )
                }
                if (!showFavorites && !showRecent) {
                    item {
                        HcText(t.t("search.emptyState"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(horizontal = 4.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                    }
                }
            }
        } else {
            Column(
                Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
                    .padding(start = HcDimens.Gutter, end = HcDimens.Gutter, bottom = HcDimens.SpaceSection),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                HcText(t.t("search.searchResults"), HcTypeRoles.Small, color = HcColors.Black, bold = true)
                FoodListCard {
                    when (resultsState) {
                        "loading" -> FoodSkeletonMediaRows(6, Modifier.padding(horizontal = 16.dp))
                        "error" -> HcText(
                            connectionMessage(t, resultsError, t.t("foods.loadError")),
                            HcTypeRoles.Body,
                            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 32.dp),
                            color = HcColors.TextSecondary,
                            align = TextAlign.Center,
                        )
                        else -> {
                            if (fromCache && results.isNotEmpty()) {
                                HcText(t.t("offline.cachedResults"), HcTypeRoles.Caption, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                            }
                            SearchCorrectionNotice(correction, onSearchInstead = { exactQuery = query }, onUseSuggestion = { query = it }, modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp))
                            ProductResultList(results, favoriteIds, t, true, ::openProduct, ::toggleFavorite)
                            if (results.isEmpty()) {
                                HcText(t.t("search.noResults"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(16.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Liste med klistret overskrift; foldepil når der er mere end tre rækker. */
@OptIn(ExperimentalFoundationApi::class)
private fun androidx.compose.foundation.lazy.LazyListScope.searchSection(
    title: String,
    items: List<FoodProductResult>,
    open: Boolean,
    onToggle: () -> Unit,
    favoriteIds: Set<String>,
    t: Translator,
    onOpen: (String) -> Unit,
    onToggleFavorite: (String, Boolean) -> Unit,
) {
    val canFold = items.size > COLLAPSED_ROWS
    stickyHeader {
        Row(
            Modifier.fillMaxWidth().background(HcColors.Page).then(if (canFold) Modifier.clickable(onClick = onToggle) else Modifier).padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            HcText(title, HcTypeRoles.Small, color = HcColors.Black, bold = true)
            if (canFold) HcIcon("ChevronDown", size = 18.dp, stroke = 1.75f, color = HcColors.Black, modifier = Modifier.rotate(if (open) 180f else 0f))
        }
    }
    val shown = if (open) items else items.take(COLLAPSED_ROWS)
    items(shown.size) { index ->
        val r = shown[index]
        val itemShape = RoundedCornerShape(
            topStart = if (index == 0) HcDimens.RadiusCard else 0.dp,
            topEnd = if (index == 0) HcDimens.RadiusCard else 0.dp,
            bottomStart = if (index == shown.lastIndex) HcDimens.RadiusCard else 0.dp,
            bottomEnd = if (index == shown.lastIndex) HcDimens.RadiusCard else 0.dp,
        )
        Column(Modifier.fillMaxWidth().clip(itemShape).background(HcColors.Tan)) {
            FoodProductResultRow(
                result = r,
                kcalText = null,
                isFavorite = r.id in favoriteIds,
                favoriteLabel = t.t(if (r.id in favoriteIds) "search.removeFavorite" else "search.addFavorite"),
                onOpen = onOpen,
                onToggleFavorite = onToggleFavorite,
                divider = index < shown.lastIndex,
            )
        }
    }
    item { Spacer(Modifier.height(16.dp)) }
}

@Serializable
private data class FavoriteRecipe(
    val id: String = "",
    val name: String = "",
    val kcal: Double = 0.0,
    /** A meal-kit dish without serving weight (BetterFeast): kcal per 100 g. */
    val per100g: Boolean = false,
    val images: List<String> = emptyList(),
)

@Serializable
private data class FavoriteRecipesResponse(val favorites: List<FavoriteRecipe> = emptyList())

/**
 * src/components/recipes/RecipeRow.tsx recipeHref — meal-kit dishes (HelloFresh "hf_", RetNemt "rn_",
 * BetterFeast "bf_"; src/lib/meal-kit-providers.ts) have their own page.
 */
fun recipeHref(id: String) =
    if (listOf("hf_", "rn_", "bf_").any { id.startsWith(it) }) "/profile/recipes/hellofresh/${encodeUri(id)}"
    else "/profile/recipes/${encodeUri(id)}?kind=shared"

/** src/components/recipes/RecipeRow.tsx (image, name, subtitle, chevron). */
@Composable
fun FoodRecipeRow(name: String, imageUrl: String?, subtitle: String, onClick: () -> Unit, divider: Boolean) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan), contentAlignment = Alignment.Center) {
                if (imageUrl != null) FoodImage(imageUrl, Modifier.size(44.dp), ContentScale.Crop)
                else HcIcon("Soup", size = 20.dp, color = HcColors.Black.copy(alpha = 0.5f))
            }
            Column(Modifier.weight(1f)) {
                HcText(name, HcTypeRoles.Body, color = HcColors.Black, bold = true, maxLines = 1)
                HcText(subtitle, HcTypeRoles.Small, color = HcColors.TextSecondary)
            }
            HcIcon("ChevronRight", size = 18.dp, color = HcColors.Black)
        }
        if (divider) FoodDivider()
    }
}

/** Native port of src/app/favorites/page.tsx — favourite foods and favourite recipes. */
@Composable
fun FavoritesScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var products by remember { mutableStateOf<List<FoodProductResult>?>(null) }
    var recipes by remember { mutableStateOf<List<FavoriteRecipe>?>(null) }

    LaunchedEffect(Unit) {
        products = runCatching { loadFavoriteProducts().also { OfflineCache.saveFavorites(it) } }.getOrElse { OfflineCache.favorites() }
    }
    LaunchedEffect(Unit) {
        recipes = runCatching {
            ApiJson.decodeFromJsonElement(FavoriteRecipesResponse.serializer(), Api.get("/api/recipe-favorites")).favorites
        }.getOrDefault(emptyList())
    }

    fun removeFavorite(productId: String, next: Boolean) {
        if (next) return
        products = products?.filter { it.id != productId }
        scope.launch { setFavorite(productId, false) }
    }

    HcScreen(t.t("favorites.title"), contentPadding = LIST_PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            HcSectionTitle(t.t("favorites.foodsTitle"))
            val p = products
            when {
                p == null -> FoodSkeletonMediaRows(3)
                p.isEmpty() -> HcText(t.t("favorites.foodsEmpty"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(horizontal = 4.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                else -> FoodListCard {
                    ProductResultList(p, p.map { it.id }.toSet(), t, false, { nav.push("/add/$it") }, ::removeFavorite)
                }
            }
            HcSectionTitle(t.t("favorites.recipesTitle"))
            val r = recipes
            when {
                r == null -> FoodSkeletonMediaRows(3)
                r.isEmpty() -> HcText(t.t("favorites.recipesEmpty"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(horizontal = 4.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                else -> Column {
                    r.forEachIndexed { index, recipe ->
                        FoodRecipeRow(
                            name = recipe.name,
                            imageUrl = recipe.images.firstOrNull(),
                            subtitle = t.t(if (recipe.per100g) "recipeFilters.kcalPer100g" else "recipes.kcalTotal", "kcal" to jsRound(recipe.kcal)),
                            onClick = { nav.push(recipeHref(recipe.id)) },
                            divider = index < r.lastIndex,
                        )
                    }
                }
            }
        }
    }
}

/** Native port of src/app/my-scans/page.tsx — own scanned products grouped by day. */
@Composable
fun MyScansScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var scans by remember { mutableStateOf<List<UserScan>>(emptyList()) }
    var state by remember { mutableStateOf("loading") }
    var loadError by remember { mutableStateOf<Throwable?>(null) }
    var favoriteIds by remember { mutableStateOf(setOf<String>()) }

    LaunchedEffect(Unit) {
        try {
            scans = ApiJson.decodeFromJsonElement(UserScansResponse.serializer(), Api.get("/api/my-scans")).scans
            state = "ready"
        } catch (e: Exception) {
            loadError = e
            state = "error"
        }
    }
    LaunchedEffect(Unit) {
        runCatching { favoriteIds = loadFavoriteProducts().map { it.id }.toSet() }
    }

    fun toggleFavorite(productId: String, next: Boolean) {
        favoriteIds = if (next) favoriteIds + productId else favoriteIds - productId
        scope.launch { setFavorite(productId, next) }
    }

    // Group by local day, newest first as delivered.
    val groups = remember(scans) {
        val map = LinkedHashMap<kotlinx.datetime.LocalDate, MutableList<FoodProductResult>>()
        for (scan in scans) {
            val day = FoodTime.parse(scan.createdAt)?.let { FoodTime.local(it).date } ?: continue
            map.getOrPut(day) { mutableListOf() } += FoodProductResult(scan.id, scan.name, scan.imageUrl, scan.brand, scan.kcalPer100g, scan.macrosEstimated)
        }
        map.entries.map { it.key to it.value.toList() }
    }

    fun dayHeading(day: kotlinx.datetime.LocalDate): String = when (day) {
        FoodTime.today() -> t.t("myScans.today")
        FoodTime.yesterday() -> t.t("myScans.yesterday")
        else -> FoodTime.longDate(day, t.locale, withYear = day.year != FoodTime.today().year).replaceFirstChar { it.uppercase() }
    }

    HcScreen(t.t("myScans.title"), contentPadding = LIST_PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            when (state) {
                "loading" -> FoodListCard { FoodSkeletonMediaRows(4, Modifier.padding(horizontal = 16.dp)) }
                "error" -> HcText(connectionMessage(t, loadError, t.t("myScans.loadError")), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                else -> if (groups.isEmpty()) HcText(t.t("myScans.empty"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
            groups.forEach { (day, items) ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcText(dayHeading(day), HcTypeRoles.Small, color = HcColors.Black, bold = true)
                    FoodDivider()
                    FoodListCard { ProductResultList(items, favoriteIds, t, true, { nav.push("/add/$it") }, ::toggleFavorite) }
                }
            }
        }
    }
}

package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
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
import dk.packroff.hellocal.ui.FoodDivider
import dk.packroff.hellocal.ui.FoodFavoriteIcon
import dk.packroff.hellocal.ui.FoodImage
import dk.packroff.hellocal.ui.FoodListCard
import dk.packroff.hellocal.ui.FoodRow
import dk.packroff.hellocal.ui.FoodSearchField
import dk.packroff.hellocal.ui.FoodSkeleton
import dk.packroff.hellocal.ui.FoodSkeletonCards
import dk.packroff.hellocal.ui.FoodSkeletonMediaRows
import dk.packroff.hellocal.ui.FoodSlider
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcLink
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.FoodPillField
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

// ---------------------------------------------------------------------------
// /foods — Madvarer (src/app/foods/page.tsx + src/lib/foods-snapshot.ts).

@Serializable
private data class FoodsSnapshot(val profileId: String = "", val products: List<ProductListItem> = emptyList(), val favoriteIds: List<String> = emptyList())

private object FoodsSnapshotStore {
    fun read(profileId: String): FoodsSnapshot? = FoodPrefs.get(FoodPrefs.FOODS_SNAPSHOT_KEY)
        ?.let { runCatching { ApiJson.decodeFromString(FoodsSnapshot.serializer(), it) }.getOrNull() }
        ?.takeIf { it.profileId == profileId }

    fun write(snapshot: FoodsSnapshot) = FoodPrefs.set(FoodPrefs.FOODS_SNAPSHOT_KEY, ApiJson.encodeToString(FoodsSnapshot.serializer(), snapshot))
}

private const val SEARCH_MIN_LENGTH = 2
private const val SEARCH_DEBOUNCE_MS = 140L
private const val SEARCH_CACHE_TTL_MS = 5 * 60 * 1000L
private const val SKELETON_DELAY_MS = 300L

/** Short-lived search cache (module level like the web's Map). */
private object FoodsSearchCache {
    val entries = mutableMapOf<String, Pair<Long, List<ProductListItem>>>()
}

/** Native port of src/app/foods/page.tsx. */
@Composable
fun FoodsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val prefill = listOfNotNull(args.opt("time")?.let { "time=${encodeUri(it)}" }, args.opt("date")?.let { "date=${encodeUri(it)}" })
        .joinToString("&").let { if (it.isEmpty()) "" else "?$it" }
    var query by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<ProductListItem>>(emptyList()) }
    var loadedSnapshot by remember { mutableStateOf<FoodsSnapshot?>(null) }
    var loadFailed by remember { mutableStateOf(false) }
    var loadError by remember { mutableStateOf<Throwable?>(null) }
    var skeletonDue by remember { mutableStateOf(false) }
    val activeProfileId = FoodFamily.status?.activeProfile?.id
    val cachedSnapshot = remember(activeProfileId) { activeProfileId?.let { FoodsSnapshotStore.read(it) } }
    val snapshot = loadedSnapshot?.takeIf { activeProfileId == null || it.profileId == activeProfileId } ?: cachedSnapshot
    val waiting = snapshot == null && !loadFailed

    LaunchedEffect(Unit) { if (FoodFamily.status == null) FoodFamily.refresh() }
    LaunchedEffect(waiting) {
        if (!waiting) return@LaunchedEffect
        delay(SKELETON_DELAY_MS)
        skeletonDue = true
    }
    LaunchedEffect(Unit) {
        try {
            val data = ApiJson.decodeFromJsonElement(ProductListResponse.serializer(), Api.get("/api/products/most-used"))
            val favoriteIds = runCatching { loadFavoriteProducts().map { it.id } }.getOrNull()
            val profileId = data.profileId ?: ""
            val next = FoodsSnapshot(profileId, data.products, favoriteIds ?: FoodsSnapshotStore.read(profileId)?.favoriteIds ?: emptyList())
            loadedSnapshot = next
            FoodsSnapshotStore.write(next)
        } catch (e: Exception) {
            loadError = e
            loadFailed = true
        }
    }

    val q = query.trim()
    val isSearching = q.length >= SEARCH_MIN_LENGTH
    val cacheKey = q.lowercase()
    LaunchedEffect(q) {
        if (q.length < SEARCH_MIN_LENGTH) return@LaunchedEffect
        val hadCacheHit = FoodsSearchCache.entries.containsKey(cacheKey)
        delay(SEARCH_DEBOUNCE_MS)
        try {
            val hour = FoodTime.local(FoodTime.now()).hour
            val products = ApiJson.decodeFromJsonElement(ProductListResponse.serializer(), Api.get("/api/products?q=${encodeUri(q)}&hour=$hour&take=20")).products
            FoodsSearchCache.entries[cacheKey] = (FoodTime.now().toEpochMilliseconds() + SEARCH_CACHE_TTL_MS) to products
            searchResults = products
        } catch (_: Exception) {
            if (!hadCacheHit) searchResults = emptyList()
        }
    }
    val cachedResults = if (isSearching) FoodsSearchCache.entries[cacheKey]?.second else null
    val favorites = snapshot?.products ?: emptyList()
    val favoriteIds = snapshot?.favoriteIds?.toSet() ?: emptySet()
    val ready = snapshot != null
    val visible = if (isSearching) cachedResults ?: searchResults else favorites

    fun toggleFavorite(productId: String, next: Boolean) {
        snapshot?.let { s ->
            val ids = s.favoriteIds.toMutableSet()
            if (next) ids += productId else ids -= productId
            val updated = s.copy(favoriteIds = ids.toList())
            loadedSnapshot = updated
            FoodsSnapshotStore.write(updated)
        }
        scope.launch { setFavorite(productId, next) }
    }

    fun trackSearchClick(productId: String) {
        if (query.trim().length < SEARCH_MIN_LENGTH) return
        val hour = FoodTime.local(FoodTime.now()).hour
        scope.launch { runCatching { Api.post("/api/products/search-event", mapOf("productId" to productId, "localHour" to hour)) } }
    }

    HcScreen(t.t("foods.title"), contentPadding = LIST_PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            FoodSearchField(query, { query = it }, t.t("foods.searchPlaceholder"))
            if (!isSearching && ready && favorites.isNotEmpty()) {
                HcText(t.t("foods.mostUsed").uppercase(), HcTypeRoles.Small, Modifier.padding(horizontal = 4.dp), color = HcColors.TextSecondary, bold = true)
            }
            FoodListCard {
                if (waiting && skeletonDue) FoodSkeletonMediaRows(3, Modifier.padding(horizontal = 16.dp))
                if (!ready && loadFailed) {
                    HcText(connectionMessage(t, loadError, t.t("foods.loadError")), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 32.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                }
                if (ready) {
                    visible.forEachIndexed { index, product ->
                        val isFavorite = product.id in favoriteIds
                        Column(Modifier.fillMaxWidth().clickable {
                            if (isSearching) trackSearchClick(product.id)
                            nav.push("/add/${product.id}$prefill")
                        }) {
                            FoodRow(
                                title = product.name,
                                image = product.imageUrl,
                                modifier = Modifier.padding(horizontal = 16.dp),
                                subtitle = {
                                    HcText(
                                        listOfNotNull(product.brand?.name, t.t("foods.kcalPer100g", "kcal" to jsRound(product.kcalPer100g))).joinToString(" · "),
                                        HcTypeRoles.Small,
                                        color = HcColors.TextSecondary,
                                        maxLines = 1,
                                    )
                                },
                                right = {
                                    Box(Modifier.size(32.dp).clip(CircleShape).clickable { toggleFavorite(product.id, !isFavorite) }, contentAlignment = Alignment.Center) {
                                        FoodFavoriteIcon(isFavorite, 20.dp, HcColors.Green)
                                    }
                                },
                            )
                            if (index < visible.lastIndex) FoodDivider()
                        }
                    }
                    if (visible.isEmpty()) {
                        HcText(
                            t.t(if (isSearching) "foods.noSearchMatches" else "foods.noFavoritesYet"),
                            HcTypeRoles.Body,
                            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 32.dp),
                            color = HcColors.TextSecondary,
                            align = TextAlign.Center,
                        )
                    }
                }
            }
            HcButton(t.t("foods.scanNewProduct"), onClick = { nav.push("/camera?mode=product") }, kind = HcButtonKind.Secondary)
        }
    }
}

/**
 * Native port of src/app/foods/new/page.tsx — new products are only created
 * by scanning; old links go to the barcode flow (?for=ret kept).
 */
@Composable
fun FoodsNewScreen(args: RouteArgs) {
    val nav = LocalNavigator.current
    LaunchedEffect(Unit) {
        nav.replace(if (args.opt("for") == "ret") "/camera?mode=product&for=ret" else "/camera?mode=product")
    }
    HcLoader()
}

// ---------------------------------------------------------------------------
// /drinks and /drinks/[id] (src/lib/drinks.ts, docs/DRINKS.md).

@Serializable
data class DrinkIngredientDto(
    val id: String = "",
    val name: String = "",
    val unit: String = "",
    val defaultAmount: Double = 0.0,
    val minAmount: Double = 0.0,
    val maxAmount: Double = 0.0,
    val step: Double = 1.0,
    val kcalPer100ml: Double = 0.0,
    val proteinPer100ml: Double = 0.0,
    val carbsPer100ml: Double = 0.0,
    val fatPer100ml: Double = 0.0,
    val sugarPer100ml: Double? = null,
    val alcoholPercent: Double? = null,
)

@Serializable
data class DrinkDto(
    val id: String = "",
    val name: String = "",
    val imageUrl: String? = null,
    val description: String? = null,
    val ingredients: List<DrinkIngredientDto> = emptyList(),
)

@Serializable
private data class DrinksResponse(val drinks: List<DrinkDto> = emptyList())

private fun ingredientMl(unit: String, amount: Double) = when (unit.lowercase()) {
    "cl" -> amount * 10
    "dl" -> amount * 100
    "l" -> amount * 1000
    else -> amount
}

private fun drinkKcal(drink: DrinkDto, amounts: Map<String, Double>): Double =
    drink.ingredients.sumOf { it.kcalPer100ml * ingredientMl(it.unit, amounts[it.id] ?: 0.0) / 100 }

private suspend fun loadDrinks(): List<DrinkDto> = ApiJson.decodeFromJsonElement(DrinksResponse.serializer(), Api.get("/api/drinks")).drinks

/** Native port of src/app/drinks/page.tsx. */
@Composable
fun DrinksScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var drinks by remember { mutableStateOf<List<DrinkDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        drinks = runCatching { loadDrinks() }.getOrDefault(emptyList())
        loading = false
    }
    val suffix = listOfNotNull(args.opt("date")?.let { "date=${encodeUri(it)}" }, args.opt("time")?.let { "time=${encodeUri(it)}" })
        .joinToString("&").let { if (it.isEmpty()) "" else "?$it" }

    HcScreen(t.t("drinks.title"), contentPadding = LIST_PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (loading) FoodSkeletonCards(4, 96.dp, 16.dp)
            if (!loading && drinks.isEmpty()) HcText(t.t("drinks.noDrinksYet"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            drinks.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    row.forEach { drink ->
                        HcCard(Modifier.weight(1f), onClick = { nav.push("/drinks/${drink.id}$suffix") }) {
                            Box(Modifier.size(96.dp).clip(CircleShape).background(HcColors.Cream).align(Alignment.CenterHorizontally), contentAlignment = Alignment.Center) {
                                if (drink.imageUrl != null) FoodImage(drink.imageUrl, Modifier.size(96.dp), ContentScale.Crop)
                                else HcIcon("GlassCocktail", size = 36.dp, color = HcColors.Black, stroke = 1.5f)
                            }
                            HcText(drink.name, HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.Black, bold = true, align = TextAlign.Center)
                        }
                    }
                    if (row.size == 1) Box(Modifier.weight(1f))
                }
            }
        }
    }
}

/** Native port of src/app/drinks/[id]/page.tsx — one slider per ingredient. */
@Composable
fun DrinkDetailScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val id = args["id"]
    var drink by remember(id) { mutableStateOf<DrinkDto?>(null) }
    var loading by remember(id) { mutableStateOf(true) }
    var amounts by remember(id) { mutableStateOf(mapOf<String, Double>()) }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(id) {
        val found = runCatching { loadDrinks().firstOrNull { it.id == id } }.getOrNull()
        drink = found
        if (found != null) amounts = found.ingredients.associate { it.id to it.defaultAmount }
        loading = false
    }
    val hasAmount = amounts.values.any { it > 0 }

    fun submit() {
        val d = drink ?: return
        if (!hasAmount) return
        saving = true
        saveError = null
        scope.launch {
            try {
                val date = args.opt("date")
                val time = args.opt("time")
                val createdAt = if (date != null || time != null) FoodTime.toInstant(date ?: FoodTime.currentDateString(), time ?: "12:00") else null
                val body = buildMap<String, Any> {
                    put("drinkId", d.id)
                    put("amounts", amounts)
                    if (createdAt != null) put("createdAt", createdAt.toString())
                }
                Api.post("/api/drinks/log", body)
                NativeHooks.onRegistrationChanged()
                if (!nav.back()) nav.resetTo("/")
            } catch (_: Exception) {
                saveError = t.t("drinks.saveError")
            }
            saving = false
        }
    }

    HcScreen(drink?.name ?: t.t("drinks.title"), contentPadding = LIST_PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (loading) Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { FoodSkeleton(Modifier.size(180.dp), CircleShape) }
            if (!loading && drink == null) HcText(t.t("drinks.notFound"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            val d = drink
            if (d != null) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Box(Modifier.size(180.dp).clip(CircleShape).background(HcColors.Tan), contentAlignment = Alignment.Center) {
                        if (d.imageUrl != null) FoodImage(d.imageUrl, Modifier.size(180.dp), ContentScale.Crop, contentDescription = d.name)
                        else HcIcon("GlassCocktail", size = 72.dp, color = HcColors.Black, stroke = 1.25f)
                    }
                }
                d.ingredients.forEach { ingredient ->
                    val value = amounts[ingredient.id] ?: 0.0
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Card).padding(HcDimens.SpaceBlock),
                        verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock),
                    ) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                            HcText(ingredient.name, HcTypeRoles.Small, Modifier.weight(1f), color = HcColors.Black, bold = true)
                            HcText("${daNumber(value, 2)} ${ingredient.unit}", HcTypeRoles.Title, color = HcColors.Black)
                        }
                        FoodSlider(
                            value = value,
                            min = ingredient.minAmount,
                            max = ingredient.maxAmount,
                            step = ingredient.step.takeIf { it > 0 } ?: 1.0,
                            onChange = { amounts = amounts + (ingredient.id to it) },
                        )
                    }
                }
                HcText(t.t("drinks.kcalTotal", "kcal" to jsRound(drinkKcal(d, amounts))), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                saveError?.let { HcText(it, HcTypeRoles.Caption, Modifier.fillMaxWidth(), align = TextAlign.Center) }
                HcButton(if (saving) t.t("drinks.saving") else t.t("drinks.add"), onClick = ::submit, enabled = !saving && hasAmount)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// /ingredients and /ingredients/new (docs/DECISIONS.md 2026-09-24).

@Serializable
private data class PrivateIngredient(val id: String = "", val name: String = "", val requestId: String? = null)

@Serializable
private data class PrivateIngredientsResponse(val ingredients: List<PrivateIngredient> = emptyList())

private suspend fun fetchPrivateIngredients(): List<PrivateIngredient> =
    runCatching { ApiJson.decodeFromJsonElement(PrivateIngredientsResponse.serializer(), Api.get("/api/private-ingredients")).ingredients }
        .getOrDefault(emptyList())

/** Native port of src/app/ingredients/page.tsx — "Mine ingredienser". */
@Composable
fun IngredientsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var ingredients by remember { mutableStateOf<List<PrivateIngredient>?>(null) }
    var editingId by remember { mutableStateOf<String?>(null) }
    var draftName by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf<PrivateIngredient?>(null) }

    LaunchedEffect(Unit) { ingredients = fetchPrivateIngredients() }

    fun saveName(id: String) {
        if (draftName.isBlank()) return
        scope.launch {
            runCatching { Api.patch("/api/private-ingredients/${encodeUri(id)}", mapOf("name" to draftName.trim())) }
            editingId = null
            ingredients = fetchPrivateIngredients()
        }
    }

    fun doRemove(ingredient: PrivateIngredient) {
        scope.launch {
            runCatching { Api.delete("/api/private-ingredients/${encodeUri(ingredient.id)}") }
            ingredients = fetchPrivateIngredients()
        }
    }

    HcScreen(t.t("privateIngredients.listTitle"), contentPadding = LIST_PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            val list = ingredients
            if (list != null && list.isEmpty()) HcText(t.t("privateIngredients.empty"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            if (!list.isNullOrEmpty()) {
                FoodListCard(radius = 16.dp) {
                    list.forEachIndexed { index, ingredient ->
                        Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
                            if (editingId == ingredient.id) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    FoodPillField(
                                        draftName,
                                        { draftName = it.take(80) },
                                        placeholder = t.t("privateIngredients.nameLabel"),
                                        modifier = Modifier.weight(1f),
                                        background = HcColors.White,
                                        shape = RoundedCornerShape(HcDimens.RadiusCard),
                                    )
                                    HcText(t.t("privateIngredients.save"), HcTypeRoles.Small, Modifier.clickable { saveName(ingredient.id) }, color = HcColors.Black, bold = true)
                                    HcText(t.t("privateIngredients.cancel"), HcTypeRoles.Small, Modifier.clickable { editingId = null }, color = HcColors.TextSecondary)
                                }
                            } else {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Column(Modifier.weight(1f)) {
                                        HcText(ingredient.name, HcTypeRoles.Body, color = HcColors.Black, bold = true)
                                        HcText(t.t("privateIngredients.pending"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                                    }
                                    HcText(t.t("privateIngredients.rename"), HcTypeRoles.Button, Modifier.clickable {
                                        editingId = ingredient.id
                                        draftName = ingredient.name
                                    }, color = HcColors.Black)
                                    HcText(t.t("privateIngredients.delete"), HcTypeRoles.Button, Modifier.clickable { confirm = ingredient }, color = HcColors.RedDark)
                                }
                            }
                        }
                        if (index < list.lastIndex) FoodDivider()
                    }
                }
            }
            HcButton(t.t("privateIngredients.createNew"), onClick = { nav.push("/ingredients/new") })
        }
    }

    // useConfirmSheet: "Fortsæt" runs the action, swipe/scrim closes without.
    confirm?.let { ingredient ->
        HcBottomSheet(onDismiss = { confirm = null }) {
            HcText(t.t("privateIngredients.deleteConfirm", "name" to ingredient.name), HcTypeRoles.Body)
            Box(Modifier.padding(top = 12.dp)) {
                HcButton(t.t("common.continue"), onClick = {
                    confirm = null
                    doRemove(ingredient)
                })
            }
        }
    }
}

/** Native port of src/app/ingredients/new/page.tsx — "Opret egen ingrediens". */
@Composable
fun IngredientNewScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val forDish = args.opt("for") == "ret"
    val useId = args.opt("use")
    var name by remember { mutableStateOf("") }
    var grams by remember { mutableStateOf("100") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(useId) {
        if (useId == null) return@LaunchedEffect
        try {
            val ingredientName = Api.get("/api/private-ingredients/${encodeUri(useId)}").obj("ingredient").str("name")
            if (ingredientName != null) name = ingredientName else error = t.t("privateIngredients.notFound")
        } catch (_: Exception) {
            error = t.t("privateIngredients.notFound")
        }
    }

    fun submit() {
        error = null
        val trimmed = name.trim()
        val amount = grams.replace(",", ".").toDoubleOrNull() ?: 0.0
        if (trimmed.isEmpty()) {
            error = t.t("privateIngredients.nameRequired")
            return
        }
        if (forDish && amount <= 0) {
            error = t.t("privateIngredients.amountRequired")
            return
        }
        saving = true
        scope.launch {
            try {
                var id = useId
                if (id == null) {
                    id = Api.post("/api/private-ingredients", mapOf("name" to trimmed)).obj("ingredient").str("id")
                        ?: throw IllegalStateException("")
                }
                if (forDish) {
                    DishDraft.append(DishDraftIngredient(productId = DishDraft.PRIVATE_INGREDIENT_PREFIX + id, name = trimmed, grams = amount))
                    nav.push("/create-dish")
                } else {
                    nav.push("/ingredients")
                }
            } catch (e: ApiException) {
                error = e.body.str("message") ?: t.t("privateIngredients.saveError")
                saving = false
            } catch (_: Exception) {
                error = t.t("privateIngredients.saveError")
                saving = false
            }
        }
    }

    HcScreen(t.t("privateIngredients.title"), contentPadding = LIST_PAGE_PADDING) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            HcText(t.t("privateIngredients.intro"), HcTypeRoles.Body, color = HcColors.Black)
            HcTextField(
                value = name,
                onValueChange = { if (useId == null) name = it.take(80) },
                label = t.t("privateIngredients.nameLabel"),
                placeholder = t.t("privateIngredients.namePlaceholder"),
                standard = true,
            )
            if (forDish) {
                HcTextField(
                    value = grams,
                    onValueChange = { grams = it },
                    label = t.t("privateIngredients.amountLabel"),
                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal,
                    standard = true,
                )
            }
            error?.let { HcText(it, HcTypeRoles.Small, color = HcColors.RedDark) }
            HcButton(
                when {
                    saving -> t.t("privateIngredients.saving")
                    forDish -> t.t("privateIngredients.addToDish")
                    else -> t.t("privateIngredients.create")
                },
                onClick = ::submit,
                enabled = !saving,
            )
            HcLink(t.t("privateIngredients.seeList"), "/ingredients", Modifier.fillMaxWidth(), role = HcTypeRoles.Small, align = TextAlign.Center)
        }
    }
}

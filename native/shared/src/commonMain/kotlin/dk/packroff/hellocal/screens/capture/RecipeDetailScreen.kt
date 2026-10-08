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
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
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
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.HcMaskIcon
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.pow
import kotlin.math.roundToLong

@Serializable
private data class RecipeStep(val title: String = "", val text: String = "", val image: String? = null)

@Serializable
private data class OwnDishProduct(
    val name: String,
    val imageUrl: String? = null,
    val kcalPer100g: Double = 0.0,
    val proteinPer100g: Double = 0.0,
    val carbsPer100g: Double = 0.0,
    val fatPer100g: Double = 0.0,
)

@Serializable
private data class OwnDishIngredient(val id: String, val grams: Double = 0.0, val product: OwnDishProduct)

@Serializable
private data class OwnDish(
    val name: String,
    val servings: Int? = null,
    val shareRejected: Boolean = false,
    val shareRejectionReason: String? = null,
    val sharedRecipeId: String? = null,
    val images: List<String> = emptyList(),
    val steps: List<RecipeStep>? = null,
    val ingredients: List<OwnDishIngredient> = emptyList(),
)

@Serializable
private data class OwnDishResponse(val dish: OwnDish)

@Serializable
private data class SharedIngredient(
    val productId: String = "",
    val name: String,
    val grams: Double = 0.0,
    val imageUrl: String? = null,
    val kcalPer100g: Double = 0.0,
    val proteinPer100g: Double = 0.0,
    val carbsPer100g: Double = 0.0,
    val fatPer100g: Double = 0.0,
)

@Serializable
private data class SharedRecipe(
    val id: String,
    val name: String,
    val canReport: Boolean = false,
    val images: List<String> = emptyList(),
    val steps: List<RecipeStep> = emptyList(),
    val ingredients: List<SharedIngredient> = emptyList(),
)

@Serializable
private data class SharedRecipeResponse(val recipe: SharedRecipe, val isFavorite: Boolean = false)

private class ViewIngredient(val key: String, val name: String, val grams: Double, val imageUrl: String?, val kcal: Double, val protein: Double, val carbs: Double, val fat: Double) {
    fun times(f: Double) = ViewIngredient(key, name, grams * f, imageUrl, kcal * f, protein * f, carbs * f, fat * f)
}

private class RecipeView(val name: String, val ingredients: List<ViewIngredient>, val images: List<String>, val steps: List<RecipeStep>)

private fun ingredient(key: String, name: String, grams: Double, imageUrl: String?, kcal: Double, protein: Double, carbs: Double, fat: Double): ViewIngredient {
    val f = grams / 100
    return ViewIngredient(key, name, grams, imageUrl, kcal * f, protein * f, carbs * f, fat * f)
}

/** Math.round(value * 10^d) / 10^d printed like a JS number. */
private fun round(value: Double, decimals: Int = 0): String {
    val factor = 10.0.pow(decimals)
    val r = (value * factor).roundToLong() / factor
    return jsNumber(r)
}

/**
 * Native port of src/app/profile/recipes/[id]/page.tsx. kind=own: the user's own
 * dish with sharing on/off; kind=shared: someone else's shared dish with
 * favourite, own copy and "Anmeld". Amounts are scaled to the chosen number of
 * persons at the user's recommended serving (src/lib/recipe-portions.ts).
 */
@Composable
fun RecipeDetailScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val id = args["id"]
    val kind = if (args.opt("kind") == "own") "own" else "shared"
    var view by remember { mutableStateOf<RecipeView?>(null) }
    var state by remember { mutableStateOf("loading") }
    var notice by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var shared by remember { mutableStateOf(false) }
    var rejection by remember { mutableStateOf<String?>(null) }
    var rejected by remember { mutableStateOf(false) }
    var dishServings by remember { mutableStateOf<Int?>(null) }
    var showShareInfo by remember { mutableStateOf(false) }
    var isFavorite by remember { mutableStateOf(false) }
    var canReport by remember { mutableStateOf(false) }
    var persons by remember { mutableStateOf(RecipeFilters.load().persons) }
    var portionKcal by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(Unit) { portionKcal = RecipePortions.portionKcal(loadProfileUser()) }

    LaunchedEffect(id, kind) {
        try {
            if (kind == "own") {
                val dish = ApiJson.decodeFromJsonElement(OwnDishResponse.serializer(), Api.get("/api/dishes/${Location.encode(id)}")).dish
                shared = dish.sharedRecipeId != null
                rejected = dish.shareRejected
                rejection = dish.shareRejectionReason
                dishServings = dish.servings
                view = RecipeView(
                    dish.name,
                    dish.ingredients.map { i ->
                        ingredient(i.id, i.product.name, i.grams, i.product.imageUrl, i.product.kcalPer100g, i.product.proteinPer100g, i.product.carbsPer100g, i.product.fatPer100g)
                    },
                    dish.images,
                    dish.steps.orEmpty(),
                )
            } else {
                val data = ApiJson.decodeFromJsonElement(SharedRecipeResponse.serializer(), Api.get("/api/shared-recipes/${Location.encode(id)}"))
                isFavorite = data.isFavorite
                canReport = data.recipe.canReport
                view = RecipeView(
                    data.recipe.name,
                    data.recipe.ingredients.mapIndexed { index, i ->
                        ingredient("${i.productId}-$index", i.name, i.grams, i.imageUrl, i.kcalPer100g, i.proteinPer100g, i.carbsPer100g, i.fatPer100g)
                    },
                    data.recipe.images,
                    data.recipe.steps,
                )
            }
            state = "ready"
        } catch (e: Exception) {
            state = "missing"
        }
    }

    fun changePersons(next: Int) {
        persons = next
        RecipeFilters.save(RecipeFilters.load().copy(persons = next))
    }

    fun changeSharing(next: Boolean) {
        busy = true
        notice = null
        shared = next
        scope.launch {
            val ok = runCatching {
                Api.patch("/api/dishes/${Location.encode(id)}/share", mapOf("shared" to next, "language" to if (t.locale == Locale.En) "en" else "da"))
            }.isSuccess
            if (!ok) {
                shared = !next
                notice = t.t("recipeDetail.shareError")
            }
            busy = false
        }
    }

    fun toggleFavorite() {
        val next = !isFavorite
        isFavorite = next
        scope.launch {
            val body = mapOf("recipeId" to id)
            val ok = runCatching { if (next) Api.post("/api/recipe-favorites", body) else Api.delete("/api/recipe-favorites", body) }.isSuccess
            if (!ok) isFavorite = !next
        }
    }

    fun saveCopy() {
        busy = true
        scope.launch {
            val ok = runCatching { Api.post("/api/shared-recipes/${Location.encode(id)}/copy") }.isSuccess
            notice = t.t(if (ok) "recipeDetail.copySaved" else "recipeDetail.copyError")
            busy = false
        }
    }

    fun report() {
        busy = true
        scope.launch {
            val ok = runCatching { Api.post("/api/shared-recipes/${Location.encode(id)}/report") }.isSuccess
            if (ok) canReport = false
            notice = t.t(if (ok) "recipeDetail.reported" else "recipeDetail.reportError")
            busy = false
        }
    }

    val current = view
    val baseKcal = current?.ingredients?.sumOf { it.kcal } ?: 0.0
    val factor = portionKcal?.let { RecipePortions.scaleFactor(baseKcal, it, persons) } ?: 1.0
    val ingredients = current?.ingredients?.map { it.times(factor) }.orEmpty()
    val totalGrams = ingredients.sumOf { it.grams }
    val totalKcal = ingredients.sumOf { it.kcal }
    val loading = state == "loading"

    HcScreen(
        title = current?.name ?: t.t("recipes.title"),
        icon = { HcIcon("Soup", size = 20.dp, stroke = 2f, color = HcColors.White) },
        contentPadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection),
        bottom = if (state != "missing" && kind == "shared") ({
            HcButton(t.t("recipeDetail.saveCopy"), onClick = ::saveCopy, enabled = !busy && !loading)
        }) else null,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
            if (loading) HcLoader()
            if (state == "missing") {
                HcText(t.t("recipeDetail.notFound"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(vertical = 32.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
            if (state == "ready" && current != null) {
                notice?.let {
                    val shape = RoundedCornerShape(HcDimens.RadiusCard)
                    HcText(it, HcTypeRoles.Small, Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(horizontal = 16.dp, vertical = 12.dp), color = HcColors.Black)
                }

                if (current.images.isNotEmpty()) RecipeImages(current.images)

                if (kind == "own") {
                    Column {
                        val shape = RoundedCornerShape(16.dp)
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clip(shape).background(HcColors.Tan, shape).padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            HcText(t.t("createDish.shareLabel"), HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.Black)
                            Box(Modifier.size(32.dp, 44.dp).clickable { showShareInfo = !showShareInfo }, contentAlignment = Alignment.Center) {
                                HcIcon("InfoCircle", size = 20.dp, color = HcColors.Black)
                            }
                            HcToggle(checked = shared, onChange = ::changeSharing, enabled = !busy)
                        }
                        if (showShareInfo) {
                            val infoShape = RoundedCornerShape(HcDimens.RadiusCard)
                            HcText(
                                t.t("createDish.shareInfo"),
                                HcTypeRoles.Small,
                                Modifier.padding(top = 8.dp).fillMaxWidth().clip(infoShape).border(1.dp, HcColors.TanDark, infoShape).background(HcColors.White)
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                color = HcColors.Black,
                            )
                        }
                    }
                    if (rejected) {
                        val shape = RoundedCornerShape(8.dp)
                        Column(Modifier.fillMaxWidth().clip(shape).border(1.dp, HcColors.TanDark, shape).background(HcColors.White).padding(horizontal = 12.dp, vertical = 8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                HcIcon("InfoCircle", size = 18.dp, color = HcColors.Black)
                                HcText(t.t("recipeDetail.shareRejected"), HcTypeRoles.Small, bold = true, color = HcColors.Black)
                            }
                            rejection?.let { HcText(t.t("recipeDetail.shareRejectedReason", "reason" to it), HcTypeRoles.Small, Modifier.padding(top = 4.dp), color = HcColors.TextSecondary) }
                        }
                    }
                    dishServings?.takeIf { it > 0 }?.let {
                        HcText(t.t("recipeDetail.servingsLabel", "count" to it), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    }
                }

                RecipeThumbs("$kind:$id")

                if (kind == "shared") {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Row(
                            Modifier.height(44.dp).clickable { toggleFavorite() },
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            HcMaskIcon(if (isFavorite) "/icons/favorite-filled.png" else "/icons/favorite.png", 20.dp, HcColors.Black)
                            HcText(t.t(if (isFavorite) "recipeDetail.removeFavorite" else "recipeDetail.addFavorite"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                        }
                        Box(Modifier.weight(1f))
                        if (canReport) {
                            HcText(
                                t.t("recipeDetail.report"),
                                HcTypeRoles.Body,
                                Modifier.clickable(enabled = !busy) { report() },
                                bold = true,
                                underline = true,
                                color = HcColors.TextSecondary,
                            )
                        }
                    }
                }

                val pk = portionKcal
                if (pk != null && baseKcal > 0) {
                    val shape = RoundedCornerShape(16.dp)
                    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(horizontal = 16.dp, vertical = 12.dp)) {
                        PersonsSlider(t.t("recipeFilters.personsTitle"), persons, RecipePortions.MAX_PERSONS, ::changePersons)
                        HcText(t.t("recipeFilters.kcalPerServing", "kcal" to round(totalKcal / persons)), HcTypeRoles.Small, Modifier.padding(top = 12.dp), color = HcColors.TextSecondary)
                    }
                }

                Column {
                    HcText(t.t("recipeDetail.ingredients"), HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), bold = true, color = HcColors.Black)
                    val shape = RoundedCornerShape(16.dp)
                    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
                        ingredients.forEachIndexed { index, ingredient ->
                            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Box(Modifier.size(36.dp)) {
                                    if (ingredient.imageUrl != null) HcRemoteImage(ingredient.imageUrl, Modifier.size(36.dp))
                                }
                                Column(Modifier.weight(1f)) {
                                    HcText(ingredient.name, HcTypeRoles.Body, bold = true, color = HcColors.Black)
                                    HcText(
                                        t.t("recipeDetail.gramsKcal", "grams" to round(ingredient.grams), "kcal" to round(ingredient.kcal)),
                                        HcTypeRoles.Small,
                                        color = HcColors.TextSecondary,
                                    )
                                }
                            }
                            if (index < ingredients.lastIndex) HcLine()
                        }
                    }
                }

                HcCard {
                    HcText(t.t("recipeDetail.total"), HcTypeRoles.Small, bold = true, color = HcColors.Black)
                    HcText(t.t("recipeDetail.gramsKcal", "grams" to round(totalGrams), "kcal" to round(totalKcal)), HcTypeRoles.Body, color = HcColors.Black)
                    HcText(
                        t.t(
                            "recipeDetail.macrosSummary",
                            "protein" to round(ingredients.sumOf { it.protein }, 1),
                            "carbs" to round(ingredients.sumOf { it.carbs }, 1),
                            "fat" to round(ingredients.sumOf { it.fat }, 1),
                        ),
                        HcTypeRoles.Small,
                        color = HcColors.TextSecondary,
                    )
                }

                if (current.steps.isNotEmpty()) {
                    Column {
                        HcText(t.t("recipeSteps.title"), HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), bold = true, color = HcColors.Black)
                        val shape = RoundedCornerShape(16.dp)
                        Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
                            current.steps.forEachIndexed { index, step ->
                                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Column(Modifier.weight(1f)) {
                                        HcText(t.t("recipeSteps.stepNumber", "number" to index + 1), HcTypeRoles.Small, bold = true, color = HcColors.TextSecondary)
                                        if (step.title.isNotEmpty()) HcText(step.title, HcTypeRoles.Body, bold = true, color = HcColors.Black)
                                        if (step.text.isNotEmpty()) HcText(step.text, HcTypeRoles.Small, color = HcColors.Black)
                                    }
                                    if (step.image != null) {
                                        HcRemoteImage(step.image, Modifier.size(64.dp).clip(RoundedCornerShape(HcDimens.RadiusCard)), contentScale = ContentScale.Crop)
                                    }
                                }
                                if (index < current.steps.lastIndex) HcLine()
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Horizontal strip of dish photos (4:3, 85 % wide when several). */
@Composable
private fun RecipeImages(images: List<String>) {
    if (images.size == 1) {
        HcRemoteImage(images.first(), Modifier.fillMaxWidth().aspectRatio(4f / 3f).clip(RoundedCornerShape(16.dp)), contentScale = ContentScale.Crop)
        return
    }
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        images.forEach { image ->
            HcRemoteImage(image, Modifier.width(280.dp).aspectRatio(4f / 3f).clip(RoundedCornerShape(16.dp)), contentScale = ContentScale.Crop)
        }
    }
}

/** src/components/recipes/RecipeThumbs.tsx — thumbs up/down per user; tap again removes it. */
@Composable
internal fun RecipeThumbs(recipeKey: String) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var value by remember { mutableStateOf(0) }

    LaunchedEffect(recipeKey) {
        value = runCatching {
            (Api.get("/api/recipe-ratings?key=${Location.encode(recipeKey)}") as? JsonObject)?.get("value")?.jsonPrimitive?.intOrNull
        }.getOrNull() ?: 0
    }

    fun rate(next: Int) {
        val previous = value
        val target = if (value == next) 0 else next
        value = target
        scope.launch {
            val ok = runCatching { Api.put("/api/recipe-ratings", mapOf("key" to recipeKey, "value" to target)) }.isSuccess
            if (!ok) value = previous
        }
    }

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        listOf(1 to "ThumbUp", -1 to "ThumbDown").forEach { (v, icon) ->
            val shape = RoundedCornerShape(8.dp)
            Box(
                Modifier.size(40.dp).clip(shape).border(1.dp, HcColors.Action, shape).clickable { rate(v) },
                contentAlignment = Alignment.Center,
            ) {
                HcIcon(if (value == v) "${icon}Filled" else icon, size = 22.dp, color = HcColors.Action, contentDescription = t.t(if (v == 1) "recipeDetail.thumbUp" else "recipeDetail.thumbDown"))
            }
        }
    }
}

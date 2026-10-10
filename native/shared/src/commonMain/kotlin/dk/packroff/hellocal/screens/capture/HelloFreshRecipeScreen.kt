package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.api.HelloCalConfig
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.screens.onboarding.measureAsGramsText
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.HcMaskIcon
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.roundToLong

@Serializable
private data class HfIngredient(val key: String, val name: String, val amount: Double? = null, val unit: String? = null, val imageUrl: String? = null)

@Serializable
private data class HfStep(val text: String = "")

@Serializable
private data class HfNutritionRow(val name: String? = null, val key: String? = null, val amount: Double = 0.0, val unit: String? = null)

@Serializable
private data class HfPhoto(val id: String, val image: String)

/** src/lib/hellofresh-recipe.ts HfRecipeView */
@Serializable
private data class HfRecipeView(
    val id: String,
    /** "hellofresh" | "retnemt" | "betterfeast" (src/lib/meal-kit-providers.ts). */
    val provider: String = "hellofresh",
    val name: String,
    val headline: String? = null,
    val description: String? = null,
    val imageUrl: String? = null,
    val totalMinutes: Int? = null,
    val difficulty: Int? = null,
    val tags: List<String> = emptyList(),
    val allergenNames: List<String> = emptyList(),
    val allergenKeys: List<String> = emptyList(),
    val ingredients: List<HfIngredient> = emptyList(),
    val steps: List<HfStep> = emptyList(),
    val nutrition: List<HfNutritionRow> = emptyList(),
    /** "portion" or "100g" (BetterFeast ready meals without serving weight). */
    val nutritionBasis: String = "portion",
    /** The full product declaration, when that is all the provider has (BetterFeast). */
    val declaration: String? = null,
    val isFavorite: Boolean = false,
    val photos: List<HfPhoto> = emptyList(),
)

@Serializable
private data class HfRecipeResponse(val recipe: HfRecipeView)

private const val HF_RECIPE_MAX_PHOTOS = 12

/** The provider's own notes (page.tsx NUTRITION_NOTES / ALLERGEN_NOTES). */
private fun nutritionNoteKey(provider: String) = when (provider) {
    "retnemt" -> "hfRecipe.nutritionNoteRetnemt"
    "betterfeast" -> "hfRecipe.nutritionNoteBetterfeast"
    else -> "hfRecipe.nutritionNote"
}

private fun allergenNoteKey(provider: String) = when (provider) {
    "hellofresh" -> "hfRecipe.allergenNote"
    "retnemt" -> "hfRecipe.allergenNoteRetnemt"
    else -> null
}

/** formatHfAmount: rounded to 3 decimals, printed like a JS number. */
private fun formatHfAmount(amount: Double): String = jsNumber((amount * 1000).roundToLong() / 1000.0)

private fun amountText(amount: Double?, unit: String?) = listOfNotNull(amount?.let(::formatHfAmount), unit?.takeIf { it.isNotEmpty() }).joinToString(" ")

/**
 * Native port of src/app/profile/recipes/hellofresh/[id]/page.tsx — a HelloFresh
 * recipe shown like the HelloFresh app (docs/DECISIONS.md 2026-09-27): edge-to-edge
 * photo, round back/share buttons, a solid top bar once the photo is scrolled away
 * and a fixed "Lad os lave mad" button. No bottom navigation. RetNemt and BetterFeast
 * dishes use the same page (2026-10-10); BetterFeast ready meals show the declaration
 * and nutrition per 100 g, and "Registrér retten" instead of the cooking steps.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HelloFreshRecipeScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val id = args["id"]
    val scroll = rememberScrollState()
    var recipe by remember { mutableStateOf<HfRecipeView?>(null) }
    var state by remember { mutableStateOf("loading") }
    var notice by remember { mutableStateOf<String?>(null) }
    var openIngredients by remember { mutableStateOf(true) }
    var openDeclaration by remember { mutableStateOf(true) }
    var openSteps by remember { mutableStateOf(true) }
    var openNutrition by remember { mutableStateOf(false) }
    var openPhotos by remember { mutableStateOf(true) }
    // Mål (dl, spsk) som i opskriften, eller omregnet til gram (KitchenConversions.kt).
    var showGrams by remember { mutableStateOf(false) }
    val conversions = rememberKitchenConversions()
    var heroHeight by remember { mutableIntStateOf(0) }
    var stepsY by remember { mutableIntStateOf(0) }

    LaunchedEffect(id) {
        try {
            recipe = ApiJson.decodeFromJsonElement(HfRecipeResponse.serializer(), Api.get("/api/hellofresh-recipes/${Location.encode(id)}")).recipe
            state = "ready"
        } catch (e: Exception) {
            state = "missing"
        }
    }

    fun goBack() {
        if (!nav.back()) nav.replace("/profile/recipes")
    }

    fun share(title: String, text: String) {
        val hook = CaptureHooks.share
        if (hook == null) notice = t.t("hfRecipe.shareUnsupported") else hook(title, text)
    }

    fun toggleFavorite() {
        val current = recipe ?: return
        val next = !current.isFavorite
        recipe = current.copy(isFavorite = next)
        scope.launch {
            val path = "/api/hellofresh-recipes/${Location.encode(id)}/favorite"
            val ok = runCatching { if (next) Api.post(path) else Api.delete(path) }.isSuccess
            if (!ok) {
                recipe = recipe?.copy(isFavorite = !next)
                notice = t.t("hfRecipe.favoriteError")
            }
        }
    }

    fun addPhoto() {
        val take = CaptureHooks.takePhoto
        if (take == null) {
            notice = t.t("hfRecipe.photoError")
            return
        }
        scope.launch {
            val bytes = runCatching { take() }.getOrNull() ?: return@launch
            try {
                val res = Api.post("/api/hellofresh-recipes/${Location.encode(id)}/photos", mapOf("image" to jpegDataUrl(bytes))).jsonObject
                val photo = res["photo"]?.jsonObject ?: throw IllegalStateException()
                val photoId = photo["id"]?.jsonPrimitive?.contentOrNull ?: throw IllegalStateException()
                val image = photo["image"]?.jsonPrimitive?.contentOrNull ?: throw IllegalStateException()
                recipe = recipe?.let { it.copy(photos = it.photos + HfPhoto(photoId, image)) }
            } catch (e: Exception) {
                notice = t.t("hfRecipe.photoError")
            }
        }
    }

    fun removePhoto(photoId: String) {
        recipe = recipe?.let { it.copy(photos = it.photos.filter { p -> p.id != photoId }) }
        scope.launch { runCatching { Api.delete("/api/hellofresh-recipes/${Location.encode(id)}/photos?photoId=${Location.encode(photoId)}") } }
    }

    // "Lad os lave mad": unfold the method and scroll to it.
    fun startCooking() {
        openSteps = true
        scope.launch { scroll.animateScrollTo(stepsY) }
    }

    val registerHref = "/add/${Location.encode(id)}"
    val r = recipe
    val solid = r?.imageUrl == null || heroHeight == 0 || scroll.value > heroHeight - 160

    Box(Modifier.fillMaxSize().background(HcColors.Page)) {
        Column(Modifier.fillMaxSize()) {
            Column(Modifier.weight(1f).verticalScroll(scroll)) {
                if (r?.imageUrl != null) {
                    HcRemoteImage(
                        r.imageUrl,
                        Modifier.fillMaxWidth().aspectRatio(10f / 7f).background(HcColors.Card).onGloballyPositioned { heroHeight = it.size.height },
                        contentScale = ContentScale.Crop,
                    )
                } else {
                    Box(Modifier.fillMaxWidth().statusBarsPadding().height(64.dp))
                }
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    if (state == "loading") HcText(t.t("hfRecipe.loading"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                    if (state == "missing") HcText(t.t("hfRecipe.notFound"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                    if (state == "ready" && r != null) {
                        notice?.let {
                            val shape = RoundedCornerShape(HcDimens.RadiusCard)
                            HcText(it, HcTypeRoles.Small, Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(12.dp), color = HcColors.Black)
                        }
                        Column {
                            HcText(r.name, HcTypeRoles.PageTitle, color = HcColors.Black)
                            r.headline?.let { HcText(it, HcTypeRoles.BodyLg, color = HcColors.TextSecondary) }
                        }
                        RecipeMeta(r)
                        if (r.tags.isNotEmpty()) RecipeTags(r.tags)

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlineButton(onClick = ::toggleFavorite) {
                                HcMaskIcon(if (r.isFavorite) "/icons/favorite-filled.png" else "/icons/favorite.png", 22.dp, HcColors.Action)
                                HcText(t.t(if (r.isFavorite) "hfRecipe.saved" else "hfRecipe.save"), HcTypeRoles.Body, bold = true, color = HcColors.Action)
                            }
                            if (r.ingredients.isNotEmpty()) OutlineButton(onClick = {
                                val lines = r.ingredients.joinToString("\n") { i ->
                                    val a = amountText(i.amount, i.unit)
                                    "• ${i.name}" + if (a.isNotEmpty()) " ($a)" else ""
                                }
                                val title = t.t("hfRecipe.shoppingListTitle", "name" to r.name)
                                share(title, "$title\n\n$lines")
                            }) { HcIcon("Basket", size = 22.dp, color = HcColors.Action) }
                            // window.print() has no native counterpart: the recipe text goes to the share sheet (print from there).
                            OutlineButton(onClick = {
                                share(r.name, "${r.name}\n\n" + r.ingredients.joinToString("\n") { "• ${it.name} ${amountText(it.amount, it.unit)}".trim() } +
                                    "\n\n" + r.steps.mapIndexed { i, s -> "${i + 1}. ${s.text}" }.joinToString("\n"))
                            }) { HcIcon("Printer", size = 22.dp, color = HcColors.Action) }
                        }
                        RecipeThumbs("hf:$id")

                        r.description?.takeIf { it.isNotBlank() }?.let { RecipeDescription(it) }

                        val allergenNames = r.allergenNames.ifEmpty { r.allergenKeys.map { t.t("recipeFilters.allergens.$it") } }
                        if (allergenNames.isNotEmpty()) {
                            HcText("${t.t("hfRecipe.allergens")}  ${allergenNames.joinToString(" • ")}", HcTypeRoles.BodyLg, color = HcColors.Black)
                        }
                        allergenNoteKey(r.provider)?.let { HcText(t.t(it), HcTypeRoles.Body, color = HcColors.TextSecondary) }

                        r.declaration?.takeIf { it.isNotBlank() }?.let { declaration ->
                            RecipeAccordion(t.t("hfRecipe.declaration"), openDeclaration, { openDeclaration = !openDeclaration }) {
                                HcText(declaration, HcTypeRoles.BodyLg, Modifier.padding(bottom = 16.dp), color = HcColors.Black)
                            }
                        }

                        if (r.ingredients.isNotEmpty()) RecipeAccordion(t.t("hfRecipe.ingredients"), openIngredients, { openIngredients = !openIngredients }) {
                            if (r.ingredients.any { measureAsGramsText(conversions, it.amount, it.unit, it.name) != null }) {
                                RecipeUnitToggle(showGrams, { showGrams = it }, Modifier.padding(bottom = 12.dp))
                            }
                            r.ingredients.forEach { i ->
                                val amount = (if (showGrams) measureAsGramsText(conversions, i.amount, i.unit, i.name) else null) ?: amountText(i.amount, i.unit)
                                IngredientRow(i.name, amount, i.imageUrl)
                            }
                        }

                        if (r.steps.isNotEmpty()) Box(Modifier.onGloballyPositioned { stepsY = it.positionInParent().y.toInt() + heroHeight }) {
                            RecipeAccordion(t.t("hfRecipe.steps"), openSteps, { openSteps = !openSteps }) {
                                r.steps.forEachIndexed { index, step ->
                                    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Box(Modifier.size(23.dp).clip(CircleShape).background(HcColors.Black), contentAlignment = Alignment.Center) {
                                            HcText("${index + 1}", HcTypeRoles.Small, bold = true, color = HcColors.White)
                                        }
                                        HcText(step.text, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                                    }
                                }
                                OutlineButton(onClick = { nav.push(registerHref) }, block = true) {
                                    HcText(t.t("hfRecipe.markCooked"), HcTypeRoles.Body, bold = true, color = HcColors.Action)
                                }
                            }
                        }

                        if (r.nutrition.isNotEmpty()) {
                            val nutritionTitle = if (r.nutritionBasis == "100g") "hfRecipe.nutritionPer100g" else "hfRecipe.nutrition"
                            RecipeAccordion(t.t(nutritionTitle), openNutrition, { openNutrition = !openNutrition }) {
                                r.nutrition.forEachIndexed { index, row ->
                                    Row(Modifier.fillMaxWidth().heightIn(min = 40.dp), verticalAlignment = Alignment.CenterVertically) {
                                        HcText(row.name ?: t.t("hfRecipe.nutrients.${row.key}"), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                                        HcText(amountText(row.amount, row.unit), HcTypeRoles.Body, color = HcColors.Black)
                                    }
                                    if (index < r.nutrition.lastIndex) HcLine()
                                }
                                HcText(t.t(nutritionNoteKey(r.provider)), HcTypeRoles.Small, Modifier.padding(top = 8.dp), color = HcColors.TextSecondary)
                                OutlineButton(onClick = { nav.push(registerHref) }, block = true) {
                                    Image(healthAppIcon, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(HcColors.Action))
                                    HcText(t.t("hfRecipe.addToHealthApp"), HcTypeRoles.Body, bold = true, color = HcColors.Action)
                                }
                            }
                        }

                        RecipeAccordion(t.t("hfRecipe.cookbookPhotos"), openPhotos, { openPhotos = !openPhotos }) {
                            if (r.photos.isNotEmpty()) {
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    r.photos.forEach { photo ->
                                        Box(Modifier.size(100.dp)) {
                                            HcRemoteImage(photo.image, Modifier.fillMaxSize().clip(RoundedCornerShape(HcDimens.RadiusCard)), contentScale = ContentScale.Crop)
                                            Box(
                                                Modifier.align(Alignment.TopEnd).padding(4.dp).size(24.dp).clip(CircleShape).background(HcColors.Black.copy(alpha = 0.6f))
                                                    .clickable { removePhoto(photo.id) },
                                                contentAlignment = Alignment.Center,
                                            ) { HcIcon("X", size = 16.dp, stroke = 2.5f, color = HcColors.White) }
                                        }
                                    }
                                }
                            }
                            if (r.photos.size < HF_RECIPE_MAX_PHOTOS) {
                                OutlineButton(onClick = ::addPhoto, block = true) {
                                    HcIcon("Camera", size = 22.dp, color = HcColors.Action)
                                    HcText(t.t("hfRecipe.addPhoto"), HcTypeRoles.Body, bold = true, color = HcColors.Action)
                                }
                            }
                        }
                    }
                }
            }
            if (state == "ready" && r != null) {
                Column(Modifier.fillMaxWidth().background(HcColors.Page).navigationBarsPadding().padding(16.dp)) {
                    // A ready meal without steps (BetterFeast) is registered directly.
                    if (r.steps.isNotEmpty()) HcButton(t.t("hfRecipe.letsCook"), onClick = ::startCooking)
                    else HcButton(t.t("hfRecipe.register"), onClick = { nav.push(registerHref) })
                }
            }
        }

        // Header: round buttons over the photo, a solid bar once it is scrolled away.
        Row(
            Modifier.fillMaxWidth()
                .let { if (solid) it.shadow(4.dp).background(HcColors.Page) else it }
                .statusBarsPadding().height(56.dp).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            HeaderButton("ArrowLeft", solid, ::goBack)
            Box(Modifier.weight(1f))
            if (r != null) HeaderButton("Share3", solid) { share(r.name, "${HelloCalConfig.BASE_URL}/profile/recipes/hellofresh/${Location.encode(id)}") }
        }
    }
}

@Composable
private fun HeaderButton(icon: String, solid: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.size(40.dp).clip(CircleShape).let { if (solid) it else it.background(HcColors.White) }.clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { HcIcon(icon, size = 24.dp, color = HcColors.Action) }
}

/** .rv-outline-button — 40 px (48 px as block), 1 px action border, radius 8. */
@Composable
private fun OutlineButton(onClick: () -> Unit, block: Boolean = false, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(8.dp)
    Row(
        Modifier.let { if (block) it.fillMaxWidth().padding(top = 8.dp).height(HcDimens.ControlHeight) else it.height(40.dp) }
            .clip(shape).border(1.dp, HcColors.Action, shape).clickable(onClick = onClick).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
    ) { content() }
}

private class MetaItem(val label: String, val kind: String, val value: String)

@Composable
private fun RecipeMeta(r: HfRecipeView) {
    val t = LocalTranslator.current
    val protein = r.nutrition.firstOrNull { it.key == "protein" || it.name?.lowercase() == "protein" }
    val items = mutableListOf<MetaItem>()
    r.totalMinutes?.let { items += MetaItem(t.t("hfRecipe.totalTime"), "time", t.t("hfRecipe.minutes", "minutes" to it)) }
    protein?.let { items += MetaItem(t.t("hfRecipe.protein"), "protein", amountText(it.amount, it.unit)) }
    r.difficulty?.let { level -> items += MetaItem(t.t("hfRecipe.difficulty"), "difficulty", t.t("hfRecipe.difficulties.$level")) }
    if (items.isEmpty()) return
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
        items.forEach { item ->
            Column {
                HcText(item.label, HcTypeRoles.Small, bold = true, color = HcColors.TextSecondary)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    when (item.kind) {
                        "time" -> HcIcon("ClockFilled", size = 18.dp, color = HcColors.Black)
                        "protein" -> Image(proteinIcon, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(HcColors.Black))
                        else -> DifficultyIcon(r.difficulty ?: 0)
                    }
                    HcText(item.value, HcTypeRoles.BodyLg, color = HcColors.Black)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecipeTags(tags: List<String>) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tags.forEach { tag ->
            Box(Modifier.height(27.dp).clip(RoundedCornerShape(4.dp)).background(HcColors.Card).padding(horizontal = 8.dp), contentAlignment = Alignment.Center) {
                HcText(tag, HcTypeRoles.Small, color = HcColors.Black)
            }
        }
    }
}

/** RecipeDescription — long texts are clamped with "Læs mere". */
@Composable
private fun RecipeDescription(text: String) {
    val t = LocalTranslator.current
    var expanded by remember { mutableStateOf(false) }
    val long = text.length > 160
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HcText(t.t("hfRecipe.description"), HcTypeRoles.PageTitle, color = HcColors.Black)
        HcText(text, HcTypeRoles.Body, color = HcColors.Black, maxLines = if (long && !expanded) 3 else Int.MAX_VALUE)
        if (long) {
            HcText(t.t(if (expanded) "hfRecipe.readLess" else "hfRecipe.readMore"), HcTypeRoles.Body, Modifier.clickable { expanded = !expanded }, bold = true, underline = true)
        }
    }
}

/** RecipeAccordion — section title with an up/down chevron. */
@Composable
private fun RecipeAccordion(title: String, open: Boolean, onToggle: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        HcLine()
        Row(Modifier.fillMaxWidth().clickable(onClick = onToggle).padding(vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            HcText(title, HcTypeRoles.PageTitle, Modifier.weight(1f), color = HcColors.Black)
            HcChevron(if (open) ChevronDirection.Up else ChevronDirection.Down)
        }
        if (open) Column(Modifier.fillMaxWidth().padding(bottom = 16.dp), content = content)
    }
}

@Composable
private fun IngredientRow(name: String, amount: String, imageUrl: String?) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        val shape = RoundedCornerShape(HcDimens.RadiusCard)
        Box(Modifier.size(48.dp).clip(shape).background(HcColors.Card, shape), contentAlignment = Alignment.Center) {
            if (imageUrl != null) HcRemoteImage(imageUrl, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            else HcIcon("ToolsKitchen2", size = 20.dp, stroke = 1.75f, color = HcColors.Black)
        }
        Column(Modifier.weight(1f)) {
            HcText(name, HcTypeRoles.Body, bold = true, color = HcColors.Black)
            if (amount.isNotEmpty()) HcText(amount, HcTypeRoles.Small, color = HcColors.TextSecondary)
        }
    }
}

/** RecipeDifficultyIcon — three bars, the first [level] filled. */
@Composable
private fun DifficultyIcon(level: Int) {
    val color = HcColors.Black
    Canvas(Modifier.size(18.dp)) {
        val s = size.width / 24f
        listOf(Triple(3f, 13f, 7f), Triple(10f, 9f, 11f), Triple(17f, 4f, 16f)).forEachIndexed { index, (x, y, h) ->
            val topLeft = Offset(x * s, y * s)
            val barSize = Size(5f * s, h * s)
            if (index < level) drawRoundRect(color, topLeft, barSize, CornerRadius(0.5f * s))
            drawRoundRect(color, topLeft, barSize, CornerRadius(0.5f * s), style = Stroke(1.6f * s))
        }
    }
}

/** RecipeProteinIcon — bent upper arm. */
private val proteinIcon: ImageVector by lazy {
    ImageVector.Builder(name = "RecipeProtein", defaultWidth = 18.dp, defaultHeight = 18.dp, viewportWidth = 24f, viewportHeight = 24f).apply {
        addPath(
            pathData = addPathNodes("M13.2 3.1c1.6-.5 3 .3 3.4 1.5.3.9 0 1.7-.6 2.3l-1.7 1.6c.5 1.5.5 3.1 0 4.5 1.1-.9 2.6-1.4 4.1-1.2 2.2.3 3.6 2.1 3.6 4.4 0 3.2-2.6 5.8-5.8 5.8H4.3c-.9 0-1.5-.9-1.2-1.7l.6-1.6c.9-2.6 2.5-4.9 4.6-6.7-.4-2.9.5-5.9 2.6-8l.2-.2c.6-.3 1.3-.6 2.1-.7Z"),
            fill = SolidColor(HcColors.Black),
        )
    }.build()
}

/** RecipeHealthAppIcon — square with a heart. */
private val healthAppIcon: ImageVector by lazy {
    ImageVector.Builder(name = "RecipeHealthApp", defaultWidth = 22.dp, defaultHeight = 22.dp, viewportWidth = 24f, viewportHeight = 24f).apply {
        addPath(pathData = addPathNodes("M3.5 2.5h17a1 1 0 0 1 1 1v17a1 1 0 0 1 -1 1h-17a1 1 0 0 1 -1 -1v-17a1 1 0 0 1 1 -1z"), stroke = SolidColor(HcColors.Black), strokeLineWidth = 2.2f)
        addPath(
            pathData = addPathNodes("M12 15.8s-4-2.4-4-5.1c0-1.2.9-2.1 2-2.1.8 0 1.5.4 2 1.1.5-.7 1.2-1.1 2-1.1 1.1 0 2 .9 2 2.1 0 2.7-4 5.1-4 5.1Z"),
            fill = SolidColor(HcColors.Black),
        )
    }.build()
}

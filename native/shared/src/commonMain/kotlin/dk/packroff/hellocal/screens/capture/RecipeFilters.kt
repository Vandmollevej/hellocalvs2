package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CaptureFilledField
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.CaptureSlider
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** src/lib/recipe-filters.ts */
internal object RecipeFilterLists {
    val allergens = listOf(
        "gluten", "crustaceans", "eggs", "fish", "peanuts", "soybeans", "milk", "nuts", "celery", "mustard", "sesame-seeds",
        "sulphur-dioxide-and-sulphites", "lupin", "molluscs", "apple", "avocado", "banana", "citrus", "garlic", "kiwi", "coconut",
        "onion", "corn", "legumes", "red-meat", "mushrooms", "stone-fruit", "strawberry", "tomato",
    )
    val diets = listOf("vegan", "vegetarian", "pescetarian", "glutenFree", "lactoseFree", "keto", "lowSugar")
    val nutrients = listOf("fiber", "iron", "calcium", "potassium", "vitaminA", "vitaminC")
    val sorts = listOf("relevance", "popular", "date")
    val macroKeys = listOf("protein", "carbs", "fat")
}

internal data class RecipeFilters(
    val sort: String = "relevance",
    val allergens: List<String> = emptyList(),
    val diets: List<String> = emptyList(),
    val nutrients: List<String> = emptyList(),
    val macros: Map<String, String> = emptyMap(),
    val persons: Int = 1,
    val showKcal: Boolean = true,
    val showEnergySplit: Boolean = false,
) {
    /** Active filters (sorting does not count) — the dot on the filter icon. */
    val activeCount: Int get() = allergens.size + diets.size + nutrients.size + RecipeFilterLists.macroKeys.count { macros[it] != null }

    fun toParams(): List<Pair<String, String>> = buildList {
        add("sort" to sort)
        if (allergens.isNotEmpty()) add("allergens" to allergens.joinToString(","))
        if (diets.isNotEmpty()) add("diets" to diets.joinToString(","))
        if (nutrients.isNotEmpty()) add("nutrients" to nutrients.joinToString(","))
        RecipeFilterLists.macroKeys.forEach { key -> macros[key]?.let { add(key to it) } }
        add("persons" to persons.toString())
        add("kcal" to if (showKcal) "1" else "0")
        add("split" to if (showEnergySplit) "1" else "0")
    }

    companion object {
        private const val STORAGE_KEY = "hellocal.recipeFilters"

        private fun pick(value: String?, allowed: List<String>) =
            value?.split(',')?.filter { it in allowed }?.distinct() ?: emptyList()

        fun fromParams(params: Map<String, String>): RecipeFilters {
            val sort = params["sort"]
            return RecipeFilters(
                sort = if (sort == "popular" || sort == "date") sort else "relevance",
                allergens = pick(params["allergens"], RecipeFilterLists.allergens),
                diets = pick(params["diets"], RecipeFilterLists.diets),
                nutrients = pick(params["nutrients"], RecipeFilterLists.nutrients),
                macros = RecipeFilterLists.macroKeys.mapNotNull { key -> params[key]?.takeIf { it == "high" || it == "low" }?.let { key to it } }.toMap(),
                persons = min(6, max(1, (params["persons"]?.toDoubleOrNull() ?: 1.0).roundToInt().let { if (it == 0) 1 else it })),
                showKcal = params["kcal"] != "0",
                showEnergySplit = params["split"] == "1",
            )
        }

        /** Remembered per device (web: localStorage "hellocal.recipeFilters"). */
        fun load(): RecipeFilters {
            val raw = NativeHooks.secureStorage.get(STORAGE_KEY) ?: return RecipeFilters()
            val obj = runCatching { ApiJson.parseToJsonElement(raw) as? JsonObject }.getOrNull() ?: return RecipeFilters()
            val params = obj.mapNotNull { (k, v) -> (v as? JsonPrimitive)?.takeIf { it.isString }?.content?.let { k to it } }.toMap()
            return fromParams(params)
        }

        fun save(filters: RecipeFilters) {
            val obj = JsonObject(filters.toParams().associate { (k, v) -> k to JsonPrimitive(v) })
            NativeHooks.secureStorage.set(STORAGE_KEY, obj.toString())
        }
    }
}

internal fun queryString(params: List<Pair<String, String>>) = params.joinToString("&") { (k, v) -> "${Location.encode(k)}=${Location.encode(v)}" }

/** src/lib/recipe-portions.ts — kcal in one recommended main-meal serving for the user. */
internal object RecipePortions {
    const val MAX_PERSONS = 6
    private const val MAIN_MEAL_SHARE = 0.3
    private const val PAL = 1.4
    private const val REFERENCE_DAILY_KCAL = 2000.0
    private val levelPal = mapOf("VERY_LOW" to 1.3, "LOW" to 1.45, "MODERATE" to 1.65, "HIGH" to 1.85, "VERY_HIGH" to 2.0)

    private fun age(birthDate: String?): Int? {
        val born = dk.packroff.hellocal.ui.CaptureDates.parseDate(birthDate) ?: return null
        val now = dk.packroff.hellocal.ui.CaptureDates.today()
        var age = now.year - born.year
        if (now.monthNumber < born.monthNumber || (now.monthNumber == born.monthNumber && now.dayOfMonth < born.dayOfMonth)) age -= 1
        return age
    }

    private fun bmr(weight: Double?, height: Double?, age: Int?, sex: String?): Double? {
        if (weight == null || weight == 0.0 || height == null || height == 0.0 || age == null || sex == null) return null
        if (age < 18) {
            val h = height / 100
            return if (sex == "MALE") when {
                age < 3 -> 0.167 * weight + 1517.4 * h - 617.6
                age < 10 -> 19.59 * weight + 130.3 * h + 414.9
                else -> 16.25 * weight + 137.2 * h + 515.5
            } else when {
                age < 3 -> 16.252 * weight + 1023.2 * h - 413.5
                age < 10 -> 16.97 * weight + 161.8 * h + 371.2
                else -> 8.365 * weight + 465 * h + 200
            }
        }
        val base = 10 * weight + 6.25 * height - 5 * age
        return if (sex == "MALE") base + 5 else base - 161
    }

    fun portionKcal(user: JsonObject?): Int {
        fun num(key: String) = (user?.get(key) as? JsonPrimitive)?.doubleOrNull
        fun str(key: String) = (user?.get(key) as? JsonPrimitive)?.contentOrNull
        val age = age(str("birthDate"))
        val bmr = if (user == null) null else bmr(num("weightKg"), num("heightCm"), age, str("sex")?.takeIf { it == "MALE" || it == "FEMALE" })
        val childPal = when {
            age == null || age >= 18 -> null
            age < 4 -> 1.4
            age < 10 -> 1.6
            else -> 1.8
        }
        val pal = childPal ?: str("activityLevel")?.let { levelPal[it] } ?: PAL
        val daily = if (bmr != null && bmr != 0.0) bmr * pal else REFERENCE_DAILY_KCAL
        return ((daily * MAIN_MEAL_SHARE) / 10).roundToInt() * 10
    }

    fun scaleFactor(totalKcal: Double, portionKcal: Int, persons: Int): Double =
        if (totalKcal <= 0 || portionKcal <= 0) 1.0 else persons * portionKcal / totalKcal
}

/** GET /api/profile → the user object (null when it cannot be read). */
internal suspend fun loadProfileUser(): JsonObject? =
    runCatching { (Api.get("/api/profile") as? JsonObject)?.get("user") as? JsonObject }.getOrNull()

/** src/components/hf/AccordionSection.tsx — tan header row that folds out a cream body. */
@Composable
internal fun AccordionSection(title: String, icon: String? = null, count: Int? = null, defaultOpen: Boolean = false, content: @Composable () -> Unit) {
    var open by remember { mutableStateOf(defaultOpen) }
    val shape = RoundedCornerShape(16.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight)
                .let { if (open) it.background(HcColors.SelectedBg) else it }
                .clickable { open = !open }.padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (icon != null) HcIcon(icon, size = 20.dp, stroke = 1.75f, color = HcColors.Black)
            HcText(title, HcTypeRoles.Body, Modifier.weight(1f), bold = true)
            if (count != null) HcText(count.toString(), HcTypeRoles.Small, color = HcColors.TextSecondary)
            HcChevron(if (open) ChevronDirection.Down else ChevronDirection.Right)
        }
        if (open) Column(Modifier.fillMaxWidth().background(HcColors.Cream)) { content() }
    }
}

/** src/components/hf/PersonsSlider.tsx — label + tappable/editable number + slider. */
@Composable
internal fun PersonsSlider(label: String, value: Int, max: Int, onChange: (Int) -> Unit, min: Int = 1) {
    var editing by remember { mutableStateOf(false) }
    var editValue by remember { mutableStateOf("") }
    Column {
        Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            HcText(label, HcTypeRoles.Small, Modifier.weight(1f), color = HcColors.TextSecondary)
            if (editing) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    CaptureFilledField(editValue, { editValue = it.filter(Char::isDigit) }, Modifier.widthIn(max = 64.dp), keyboardType = KeyboardType.Number, background = HcColors.White, minHeight = 36.dp)
                    HcIcon("Check", size = 20.dp, color = HcColors.Black, modifier = Modifier.clickable {
                        editValue.toIntOrNull()?.let { onChange(it.coerceIn(min, max)) }
                        editing = false
                    })
                }
            } else {
                HcText(value.toString(), HcTypeRoles.Body, Modifier.clickable {
                    editValue = value.toString()
                    editing = true
                }.padding(horizontal = 4.dp), bold = true, color = HcColors.Black)
            }
        }
        CaptureSlider(value = value, min = min, max = max, onChange = onChange)
    }
}

/** One label + switch row inside a filter section. */
@Composable
private fun FilterRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit, divider: Boolean = true) {
    Column {
        Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            HcText(label, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
            HcToggle(checked = checked, onChange = onChange)
        }
        if (divider) HcLine()
    }
}

private val MACRO_OPTIONS = listOf("protein" to "high", "protein" to "low", "carbs" to "high", "carbs" to "low", "fat" to "high", "fat" to "low")
private val SORT_KEYS = mapOf("relevance" to "recipes.sortRelevance", "popular" to "recipes.sortPopular", "date" to "recipes.sortDate")

/**
 * src/components/recipes/RecipeFiltersBody.tsx — filter content for "Delte
 * retter"; used in the filter sheet and on /profile/recipes/filters. Saved at once.
 */
@Composable
internal fun RecipeFiltersBody(onChange: ((RecipeFilters) -> Unit)? = null) {
    val t = LocalTranslator.current
    var filters by remember { mutableStateOf(RecipeFilters.load()) }
    var portionKcal by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(Unit) { portionKcal = RecipePortions.portionKcal(loadProfileUser()) }

    fun update(next: RecipeFilters) {
        filters = next
        RecipeFilters.save(next)
        onChange?.invoke(next)
    }

    fun toggleIn(list: List<String>, value: String, on: Boolean) = if (on) (if (value in list) list else list + value) else list - value

    val allergens = remember(t) { RecipeFilterLists.allergens.map { it to t.t("recipeFilters.allergens.$it") }.sortedBy { it.second.lowercase() } }

    Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
        AccordionSection(t.t("recipeFilters.personsTitle"), icon = "UsersGroup", count = filters.persons) {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                PersonsSlider(t.t("recipeFilters.personsLabel"), filters.persons, RecipePortions.MAX_PERSONS, { update(filters.copy(persons = it)) })
                portionKcal?.let { HcText(t.t("recipeFilters.portionHint", "kcal" to it), HcTypeRoles.Small, Modifier.padding(top = 12.dp), color = HcColors.TextSecondary) }
            }
        }
        AccordionSection(t.t("recipeFilters.displayTitle"), icon = "Eye") {
            Column(Modifier.padding(horizontal = 16.dp)) {
                FilterRow(t.t("recipeFilters.showKcal"), filters.showKcal, { update(filters.copy(showKcal = it)) })
                FilterRow(t.t("recipeFilters.showEnergySplit"), filters.showEnergySplit, { update(filters.copy(showEnergySplit = it)) }, divider = false)
            }
        }
        AccordionSection(t.t("recipeFilters.sortTitle"), icon = "ArrowsSort") {
            Column(Modifier.padding(horizontal = 16.dp)) {
                RecipeFilterLists.sorts.forEachIndexed { index, sort ->
                    // One sort at a time; switching the chosen one off falls back to relevance.
                    FilterRow(t.t(SORT_KEYS.getValue(sort)), filters.sort == sort, { on -> update(filters.copy(sort = if (on) sort else "relevance")) }, divider = index < RecipeFilterLists.sorts.lastIndex)
                }
            }
        }
        AccordionSection(t.t("recipeFilters.allergiesTitle"), icon = "MedicalCross", count = filters.allergens.size.takeIf { it > 0 }) {
            Column(Modifier.padding(horizontal = 16.dp)) {
                allergens.forEachIndexed { index, (key, label) ->
                    FilterRow(label, key in filters.allergens, { on -> update(filters.copy(allergens = toggleIn(filters.allergens, key, on))) }, divider = index < allergens.lastIndex)
                }
            }
        }
        AccordionSection(t.t("recipeFilters.dietsTitle"), icon = "Meat", count = filters.diets.size.takeIf { it > 0 }) {
            Column(Modifier.padding(horizontal = 16.dp)) {
                RecipeFilterLists.diets.forEachIndexed { index, key ->
                    FilterRow(t.t("recipeFilters.diets.$key"), key in filters.diets, { on -> update(filters.copy(diets = toggleIn(filters.diets, key, on))) }, divider = index < RecipeFilterLists.diets.lastIndex)
                }
            }
        }
        AccordionSection(t.t("recipeFilters.specialTitle"), icon = "Leaf", count = filters.nutrients.size.takeIf { it > 0 }) {
            Column(Modifier.padding(horizontal = 16.dp)) {
                RecipeFilterLists.nutrients.forEachIndexed { index, key ->
                    FilterRow(t.t("recipeFilters.nutrients.$key"), key in filters.nutrients, { on -> update(filters.copy(nutrients = toggleIn(filters.nutrients, key, on))) }, divider = index < RecipeFilterLists.nutrients.lastIndex)
                }
            }
        }
        AccordionSection(t.t("recipeFilters.macrosTitle"), icon = "List", count = MACRO_OPTIONS.count { (k, l) -> filters.macros[k] == l }.takeIf { it > 0 }) {
            Column(Modifier.padding(horizontal = 16.dp)) {
                MACRO_OPTIONS.forEachIndexed { index, (key, level) ->
                    FilterRow(
                        t.t("recipeFilters.macros.$key-$level"),
                        filters.macros[key] == level,
                        { on ->
                            val macros = filters.macros.toMutableMap()
                            if (on) macros[key] = level else if (macros[key] == level) macros.remove(key)
                            update(filters.copy(macros = macros))
                        },
                        divider = index < MACRO_OPTIONS.lastIndex,
                    )
                }
            }
        }
        // The display choices (persons, kcal, energy split) are kept.
        HcButton(
            t.t("recipeFilters.reset"),
            onClick = { update(RecipeFilters(persons = filters.persons, showKcal = filters.showKcal, showEnergySplit = filters.showEnergySplit)) },
            kind = HcButtonKind.Secondary,
        )
    }
}

/** Native port of src/app/profile/recipes/filters/page.tsx (old link; same content as the sheet). */
@Composable
fun RecipeFiltersScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val t = LocalTranslator.current
    HcScreen(title = t.t("recipeFilters.title")) {
        RecipeFiltersBody()
    }
}

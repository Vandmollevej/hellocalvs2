package dk.packroff.hellocal.screens.profile

import dk.packroff.hellocal.ui.HeightUnit
import dk.packroff.hellocal.ui.UnitPrefs
import dk.packroff.hellocal.ui.Units
import dk.packroff.hellocal.ui.WeightUnit
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.FoodSlider
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileBrandCard
import dk.packroff.hellocal.ui.ProfileDateWheelSheet
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch

/** src/components/hf/GoalForm.tsx GoalFormValues — values in kg / cm ("," decimals) until shown in the user's unit. */
data class GoalFormValues(
    val targetDate: String = "",
    val weight: String = "",
    val measurements: Map<String, String> = emptyMap(),
    val composition: Map<String, String> = emptyMap(),
    val nutrition: Map<String, String> = emptyMap(),
) {
    companion object {
        fun from(goal: Goal): GoalFormValues {
            fun input(value: Double) = jsNumber(value).replace(".", ",")
            val measurements = mutableMapOf<String, String>()
            val composition = mutableMapOf<String, String>()
            val nutrition = mutableMapOf<String, String>()
            var weight = ""
            for (target in goal.targets) {
                when {
                    target.type == "weight" -> weight = input(target.value)
                    BODY_MEASUREMENT_FIELDS.any { it.field == target.type } -> measurements[target.type] = input(target.value)
                    COMPOSITION_GOAL_FIELDS.any { it.field == target.type } -> composition[target.type] = input(target.value)
                    NUTRITION_GOAL_FIELDS.any { it.field == target.type } -> nutrition[target.type] = input(target.value)
                }
            }
            return GoalFormValues(goal.targetDate ?: "", weight, measurements, composition, nutrition)
        }
    }
}

/** src/lib/goal-slider-ranges.ts — slider interval in the displayed unit. */
private data class SliderRange(val min: Double, val max: Double, val step: Double)

private fun sliderRange(id: String, units: UnitPrefs): SliderRange? = when (id) {
    "weight" -> when (units.weight) {
        WeightUnit.Kg -> SliderRange(30.0, 200.0, 0.5)
        WeightUnit.Lb -> SliderRange(66.0, 440.0, 1.0)
        WeightUnit.St -> null // stone/pounds ("10 4") is not one number
    }
    "bodyFatPercent" -> SliderRange(3.0, 60.0, 0.5)
    "muscleMassKg" -> SliderRange(10.0, 80.0, 0.5)
    "kcal" -> SliderRange(800.0, 5000.0, 50.0)
    "proteinG" -> SliderRange(20.0, 400.0, 5.0)
    "carbsG" -> SliderRange(20.0, 800.0, 5.0)
    "fatG" -> SliderRange(10.0, 300.0, 5.0)
    else -> if (BODY_MEASUREMENT_FIELDS.any { it.field == id }) {
        if (units.height == HeightUnit.In) SliderRange(8.0, 80.0, 0.5) else SliderRange(20.0, 200.0, 0.5)
    } else null
}

/** A parsed form value: Empty (ignored), Invalid, or a number. */
private sealed interface Parsed {
    data object Empty : Parsed
    data object Invalid : Parsed
    data class Value(val number: Double) : Parsed
}

private fun parseValue(raw: String): Parsed {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return Parsed.Empty
    val parsed = trimmed.replaceFirst(",", ".").toDoubleOrNull()
    return if (parsed != null && parsed.isFinite() && parsed > 0) Parsed.Value(parsed) else Parsed.Invalid
}

private fun parseConverted(raw: String, convert: (String) -> Double?): Parsed {
    if (raw.isBlank()) return Parsed.Empty
    val value = convert(raw) ?: return Parsed.Invalid
    return Parsed.Value(round1(value))
}

/** Native port of src/app/profile/goals/new/page.tsx (Seriøs only, layout.tsx PremiumGate). */
@Composable
fun NewGoalScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    ProfilePremiumGate("goals.createSubGoal") {
        GoalForm(title = t.t("goals.createSubGoal"), initial = GoalFormValues()) { targetDate, targets ->
            Api.post("/api/goals", mapOf("targetDate" to targetDate, "targets" to targets))
            // Back to the overview (which opened the form), so no navigation loop.
            nav.back()
        }
    }
}

/** Native port of src/app/profile/goals/[id]/edit/page.tsx (Seriøs only). */
@Composable
fun EditGoalScreen(args: RouteArgs) {
    val id = args["id"]
    val focus = args.opt("focus")
    key(id) {
        ProfilePremiumGate("goals.editTitle") { EditGoal(id, focus) }
    }
}

@Composable
private fun EditGoal(id: String, focus: String?) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var initial by remember { mutableStateOf<GoalFormValues?>(null) }
    var status by remember { mutableStateOf("loading") }
    LaunchedEffect(id) {
        status = try {
            val goal = GoalsApi.get(id)
            initial = goal?.let { GoalFormValues.from(it) }
            if (goal == null) "notFound" else "ready"
        } catch (e: Exception) {
            "error"
        }
    }
    val values = initial
    if (status != "ready" || values == null) {
        HcScreen(title = t.t("goals.editTitle")) {
            HcText(
                when (status) {
                    "loading" -> t.t("goals.loading")
                    "notFound" -> t.t("goals.notFound")
                    else -> t.t("goals.loadError")
                },
                HcTypeRoles.Body,
                Modifier.fillMaxWidth().padding(start = 32.dp, end = 32.dp, top = 48.dp),
                color = HcColors.TextSecondary,
                align = TextAlign.Center,
            )
        }
        return
    }
    GoalForm(title = t.t("goals.editTitle"), initial = values, focus = focus) { targetDate, targets ->
        Api.patch("/api/goals/${Location.encode(id)}", mapOf("targetDate" to targetDate, "targets" to targets))
        // Back to the page that opened editing; it loads again.
        nav.back()
    }
}

/**
 * src/components/hf/GoalForm.tsx — date, weight, body measurements,
 * composition and nutrition. Saving (POST/PATCH) is done by the page; it throws on errors.
 */
@Composable
private fun GoalForm(
    title: String,
    initial: GoalFormValues,
    focus: String? = null,
    onSubmit: suspend (targetDate: String, targets: Map<String, Double>) -> Unit,
) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val units = remember { Units.current() }
    var targetDate by remember { mutableStateOf(initial.targetDate) }
    var pickingDate by remember { mutableStateOf(false) }
    // Start values come in kg/cm; show them in the chosen unit.
    var weight by remember {
        val kg = initial.weight.replaceFirst(",", ".").toDoubleOrNull()
        mutableStateOf(if (initial.weight.isNotBlank() && kg != null) Units.weightToInputValue(kg, units.weight) else initial.weight)
    }
    val measurements = remember {
        mutableStateMapOf<String, String>().apply {
            BODY_MEASUREMENT_FIELDS.forEach { (field) ->
                val raw = initial.measurements[field] ?: ""
                val cm = raw.replaceFirst(",", ".").toDoubleOrNull()
                put(field, if (raw.isNotBlank() && cm != null) Units.lengthToInputValue(cm, units.height) else raw)
            }
        }
    }
    val composition = remember { mutableStateMapOf<String, String>().apply { putAll(initial.composition) } }
    val nutrition = remember { mutableStateMapOf<String, String>().apply { putAll(initial.nutrition) } }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf(false) }
    // The field in focus gets a full-width slider above the keyboard (GoalSliderBar in GoalForm.tsx).
    var activeId by remember { mutableStateOf<String?>(null) }
    val activeRange = activeId?.let { sliderRange(it, units) }
    fun activeValue(): String = when (val id = activeId) {
        "weight" -> weight
        null -> ""
        else -> measurements[id] ?: composition[id] ?: nutrition[id] ?: ""
    }
    fun setActive(value: String) {
        when (val id = activeId) {
            "weight" -> weight = value
            null -> Unit
            else -> when {
                measurements.containsKey(id) -> measurements[id] = value
                composition.containsKey(id) -> composition[id] = value
                else -> nutrition[id] = value
            }
        }
    }

    // Weight and body measurements are typed in the chosen unit but always saved as kg/cm.
    val parsed: Map<String, Parsed> = buildMap {
        put("weight", parseConverted(weight) { Units.parseWeightInput(it, units.weight) })
        BODY_MEASUREMENT_FIELDS.forEach { put(it.field, parseConverted(measurements[it.field] ?: "") { raw -> Units.parseLengthInput(raw, units.height) }) }
        COMPOSITION_GOAL_FIELDS.forEach { put(it.field, parseValue(composition[it.field] ?: "")) }
        NUTRITION_GOAL_FIELDS.forEach { put(it.field, parseValue(nutrition[it.field] ?: "")) }
    }
    val hasInvalid = parsed.values.any { it is Parsed.Invalid }
    val hasAny = parsed.values.any { it is Parsed.Value }
    val today = ProfileDates.todayIso()
    val hasDate = targetDate.isNotEmpty() && targetDate >= today
    val canSave = hasDate && hasAny && !hasInvalid && !saving

    fun save() {
        if (!canSave) return
        val targets = parsed.mapNotNull { (key, value) -> (value as? Parsed.Value)?.let { key to it.number } }.toMap()
        saving = true
        saveError = false
        scope.launch {
            try {
                onSubmit(targetDate, targets)
            } catch (e: Exception) {
                saveError = true
                saving = false
            }
        }
    }

    HcScreen(
        title = title,
        contentPadding = ProfilePagePadding,
        bottom = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (activeId != null && activeRange != null) {
                    val decimals = activeRange.step < 1
                    val current = activeValue().trim().replaceFirst(",", ".").toDoubleOrNull()?.coerceIn(activeRange.min, activeRange.max) ?: activeRange.min
                    FoodSlider(
                        value = current,
                        min = activeRange.min,
                        max = activeRange.max,
                        step = activeRange.step,
                        onChange = { next -> setActive(if (decimals) jsNumber(round1(next)).replace(".", ",") else next.toLong().toString()) },
                    )
                }
                if (!hasDate || !hasAny) {
                    HcText(
                        if (!hasDate) t.t("goals.dateRequired") else t.t("goals.atLeastOne"),
                        HcTypeRoles.Small,
                        Modifier.fillMaxWidth(),
                        color = HcColors.TextSecondary,
                        align = TextAlign.Center,
                    )
                }
                if (saveError) HcText(t.t("goals.saveError"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center)
                HcButton(if (saving) t.t("goals.saving") else t.t("goals.save"), onClick = ::save, enabled = canSave)
            }
        },
    ) {
        ProfilePage {
            // The date picker is at the top of the page.
            FormCard {
                HcText(t.t("goals.targetDate"), HcTypeRoles.Small, bold = true, color = HcColors.Black)
                Column(Modifier.fillMaxWidth().clickable { pickingDate = true }) {
                    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.Bottom) {
                        HcText(
                            if (targetDate.isEmpty()) t.t("goals.targetDatePlaceholder") else ProfileDates.goalDate(targetDate),
                            HcTypeRoles.BodyLg,
                            Modifier.weight(1f),
                            color = if (targetDate.isEmpty()) HcColors.TextSecondary else HcColors.Black,
                        )
                        HcIcon("Calendar", size = 18.dp, color = HcColors.Black, modifier = Modifier.alpha(0.6f).padding(bottom = 4.dp))
                    }
                    HorizontalDivider(thickness = 1.dp, color = HcColors.Black.copy(alpha = 0.3f))
                }
            }
            ProfileBrandCard(t.t("goals.intro"))
            FormCard {
                GoalInput(
                    label = t.t("goals.targetWeight"),
                    unit = Units.weightUnitLabel(units.weight),
                    value = weight,
                    placeholder = Units.weightToInputValue(72.0, units.weight),
                    autoFocus = focus == "weight",
                    onChange = { weight = it },
                    onActivate = { activeId = "weight" },
                )
            }
            FormCard(gap = HcDimens.SpaceBlock) {
                HcText(t.t("goals.bodyMeasurementsHeading"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                TwoColumns(BODY_MEASUREMENT_FIELDS) { field ->
                    GoalInput(
                        label = t.t(field.nameKey),
                        unit = Units.lengthUnitLabel(units.height),
                        value = measurements[field.field] ?: "",
                        placeholder = Units.lengthToInputValue(82.0, units.height),
                        autoFocus = focus == field.field,
                        onChange = { measurements[field.field] = it },
                        onActivate = { activeId = field.field },
                    )
                }
            }
            FormCard(gap = HcDimens.SpaceBlock) {
                HcText(t.t("goals.compositionHeading"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                TwoColumns(COMPOSITION_GOAL_FIELDS) { field ->
                    GoalInput(
                        label = t.t(field.nameKey),
                        unit = field.unit,
                        value = composition[field.field] ?: "",
                        placeholder = t.t("goals.compositionPlaceholder.${field.field}"),
                        autoFocus = focus == field.field,
                        onChange = { composition[field.field] = it },
                        onActivate = { activeId = field.field },
                    )
                }
            }
            FormCard(gap = HcDimens.SpaceBlock) {
                HcText(t.t("goals.nutritionHeading"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                TwoColumns(NUTRITION_GOAL_FIELDS) { field ->
                    GoalInput(
                        label = t.t(field.nameKey),
                        unit = field.unit,
                        value = nutrition[field.field] ?: "",
                        placeholder = t.t("goals.nutritionPlaceholder.${field.field}"),
                        autoFocus = focus == field.field,
                        onChange = { nutrition[field.field] = it },
                        onActivate = { activeId = field.field },
                    )
                }
            }
        }
    }

    if (pickingDate) {
        val todayDate = ProfileDates.today()
        val current = ProfileDates.parseDay(targetDate)?.takeIf { it >= todayDate } ?: todayDate
        ProfileDateWheelSheet(
            label = t.t("goals.targetDate"),
            initial = Triple(current.year, current.monthNumber, current.dayOfMonth),
            minDate = Triple(todayDate.year, todayDate.monthNumber, todayDate.dayOfMonth),
            maxDate = Triple(todayDate.year + 10, 12, 31),
            yearsDescending = false,
            onDismiss = { pickingDate = false },
            onDone = { (y, m, d) ->
                targetDate = "$y-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}"
            },
        )
    }
}

/** .hf-card (8 px gap) or .hf-card--form (16 px gap). */
@Composable
private fun FormCard(gap: androidx.compose.ui.unit.Dp = HcDimens.SpaceInline, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(HcColors.Card, shape).padding(HcDimens.SpaceBlock),
        verticalArrangement = Arrangement.spacedBy(gap),
        content = content,
    )
}

@Composable
private fun <T> TwoColumns(items: List<T>, cell: @Composable (T) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        items.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                row.forEach { item -> Column(Modifier.weight(1f)) { cell(item) } }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

/** GoalInput: label above, number and unit on one line with a thin line under it. */
@Composable
private fun GoalInput(label: String, unit: String, value: String, placeholder: String, autoFocus: Boolean, onChange: (String) -> Unit, onActivate: () -> Unit) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(autoFocus) { if (autoFocus) runCatching { focus.requestFocus() } }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        HcText(label, HcTypeRoles.Small, bold = true, color = HcColors.Black)
        Row(Modifier.fillMaxWidth().heightIn(min = 32.dp).padding(bottom = 8.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BasicTextField(
                value = value,
                onValueChange = onChange,
                singleLine = true,
                textStyle = HcTypeRoles.BodyLg.style(HcColors.Black),
                cursorBrush = SolidColor(HcColors.Action),
                keyboardOptions = KeyboardOptions(keyboardType = if (unit.contains(' ')) KeyboardType.Text else KeyboardType.Decimal),
                modifier = Modifier.weight(1f).focusRequester(focus).onFocusChanged { if (it.isFocused) onActivate() },
                decorationBox = { inner ->
                    androidx.compose.foundation.layout.Box {
                        if (value.isEmpty()) HcText(placeholder, HcTypeRoles.BodyLg, color = HcColors.Placeholder, maxLines = 1)
                        inner()
                    }
                },
            )
            HcText(unit, HcTypeRoles.Small, Modifier.padding(bottom = 4.dp), bold = true, color = HcColors.TextSecondary)
        }
        HorizontalDivider(thickness = 1.dp, color = HcColors.Black.copy(alpha = 0.3f))
    }
}

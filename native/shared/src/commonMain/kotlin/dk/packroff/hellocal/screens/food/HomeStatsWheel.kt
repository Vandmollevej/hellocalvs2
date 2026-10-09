package dk.packroff.hellocal.screens.food

import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.FoodIcon
import dk.packroff.hellocal.ui.FoodIconSpec
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.Serializable
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

// src/lib/frontpage-stats.ts + src/components/StatsWheel.tsx — the front page's
// number wheel with today's key figures.

data class FrontpageTotals(
    val kcal: Double = 0.0, val protein: Double = 0.0, val carbs: Double = 0.0, val fat: Double = 0.0,
    val sugar: Double = 0.0, val fiber: Double = 0.0, val salt: Double = 0.0, val potassium: Double = 0.0,
    val calcium: Double = 0.0, val iron: Double = 0.0, val saturatedFat: Double = 0.0, val unsaturatedFat: Double = 0.0,
    val transFat: Double = 0.0, val cholesterol: Double = 0.0, val vitaminA: Double = 0.0, val vitaminC: Double = 0.0,
)

data class FrontpageMetrics(val steps: Double?, val waterMl: Double?, val burnedKcal: Double?, val distanceKm: Double?)

data class FrontpageStatData(val totals: FrontpageTotals, val metrics: FrontpageMetrics, val goalKcal: Double)

data class FrontpageStatDef(val key: String, val labelKey: String, val icon: FoodIconSpec, val compute: (FrontpageStatData) -> Pair<String, String>)

private val DROPLET = FoodIconSpec.Tabler("Droplet")

val FRONTPAGE_STAT_DEFS: List<FrontpageStatDef> = listOf(
    FrontpageStatDef("calories", "frontPageStats.calories", FoodIconSpec.Drumstick) { daNumber(it.totals.kcal) to "kcal" },
    FrontpageStatDef("kcalRemaining", "frontPageStats.kcalRemaining", FoodIconSpec.Drumstick) { daNumber(max(0.0, it.goalKcal - it.totals.kcal)) to "kcal" },
    FrontpageStatDef("protein", "frontPageStats.protein", FoodIconSpec.Tabler("Egg")) { daNumber(it.totals.protein) to "g" },
    FrontpageStatDef("carbs", "frontPageStats.carbs", FoodIconSpec.Tabler("ToolsKitchen2")) { daNumber(it.totals.carbs) to "g" },
    FrontpageStatDef("fat", "frontPageStats.fat", DROPLET) { daNumber(it.totals.fat) to "g" },
    FrontpageStatDef("sugar", "frontPageStats.sugar", FoodIconSpec.Tabler("Candy")) { daNumber(it.totals.sugar, 1) to "g" },
    FrontpageStatDef("fiber", "frontPageStats.fiber", FoodIconSpec.Tabler("Leaf")) { daNumber(it.totals.fiber, 1) to "g" },
    FrontpageStatDef("salt", "frontPageStats.salt", FoodIconSpec.Tabler("Salt")) { daNumber(it.totals.salt, 1) to "g" },
    FrontpageStatDef("potassium", "frontPageStats.potassium", FoodIconSpec.Tabler("Apple")) { daNumber(it.totals.potassium) to "mg" },
    FrontpageStatDef("calcium", "frontPageStats.calcium", FoodIconSpec.Tabler("Bone")) { daNumber(it.totals.calcium) to "mg" },
    FrontpageStatDef("iron", "frontPageStats.iron", FoodIconSpec.Tabler("Atom2")) { daNumber(it.totals.iron, 1) to "mg" },
    FrontpageStatDef("saturatedFat", "frontPageStats.saturatedFat", DROPLET) { daNumber(it.totals.saturatedFat, 1) to "g" },
    FrontpageStatDef("unsaturatedFat", "frontPageStats.unsaturatedFat", DROPLET) { daNumber(it.totals.unsaturatedFat, 1) to "g" },
    FrontpageStatDef("transFat", "frontPageStats.transFat", DROPLET) { daNumber(it.totals.transFat, 2) to "g" },
    FrontpageStatDef("cholesterol", "frontPageStats.cholesterol", FoodIconSpec.Tabler("Heartbeat")) { daNumber(it.totals.cholesterol) to "mg" },
    FrontpageStatDef("vitaminA", "frontPageStats.vitaminA", FoodIconSpec.Tabler("Apple")) { daNumber(it.totals.vitaminA) to "µg" },
    FrontpageStatDef("vitaminC", "frontPageStats.vitaminC", FoodIconSpec.Tabler("Lemon2")) { daNumber(it.totals.vitaminC) to "mg" },
    FrontpageStatDef("water", "frontPageStats.water", FoodIconSpec.Mask("/icons/water-glass.png")) {
        (it.metrics.waterMl?.let { ml -> daNumber(ml / 1000, 1) } ?: "1,6") to "l"
    },
    FrontpageStatDef("burned", "frontPageStats.burned", FoodIconSpec.Tabler("Flame")) {
        (it.metrics.burnedKcal?.let { k -> daNumber(k) } ?: "642") to "kcal"
    },
    FrontpageStatDef("steps", "frontPageStats.steps", FoodIconSpec.Tabler("Footsteps")) {
        (it.metrics.steps?.let { s -> daNumber(s) } ?: "6.210") to ""
    },
    FrontpageStatDef("distanceKm", "frontPageStats.distanceKm", FoodIconSpec.Tabler("Route")) {
        (it.metrics.distanceKm?.let { d -> daNumber(d, 1) } ?: "–") to "km"
    },
)

/** DAILY_KCAL_GOAL fallback (src/lib/goals.ts). */
const val DAILY_KCAL_GOAL = 3299.0

@Serializable
private data class HealthMetricDto(val type: String = "", val value: Double = 0.0, val recordedAt: String = "")

@Serializable
private data class HealthMetricsResponse(val metrics: List<HealthMetricDto> = emptyList())

private data class WheelStat(val key: String, val label: String, val icon: FoodIconSpec, val value: String, val unit: String, val caption: List<String>? = null)

private const val SIDE_ROWS = 3
private const val FONT_SIZE = 27f
private const val STAT_ICON_SIZE = 21f
private const val ROW_GAP = 15f
private const val SCALE_STEP = 0.12f
private const val MIN_SCALE = 0.6f
private const val TILT_PER_ROW = 2f
private const val MAX_INSET = 25f
private const val DRAG_STEP = 38f
private const val CAPTION_SPACE = 16f
private const val ROW_HEIGHT = FONT_SIZE + CAPTION_SPACE
private const val VERTICAL_SHIFT = -7f
private const val DIVIDER_BELOW_HERO = 18f
private const val CAPTION_PLACEHOLDER = "Dummytekst"

private fun offsetAt(absDistance: Float): Float {
    val knee = (1 - MIN_SCALE) / SCALE_STEP
    val shrinking = min(absDistance, knee)
    val flat = max(0f, absDistance - knee)
    return ROW_GAP * absDistance + ROW_HEIGHT * (shrinking - (SCALE_STEP / 2) * shrinking * shrinking) + ROW_HEIGHT * MIN_SCALE * flat
}

private fun scaleAt(absDistance: Float) = max(MIN_SCALE, 1 - absDistance * SCALE_STEP)

private val WHEEL_HEIGHT = 2 * (offsetAt(SIDE_ROWS.toFloat()) + ROW_HEIGHT)

/**
 * Middle of the wheel's last row in dp from the hero's top — the web's
 * data-stats-wheel-last-row (rowOffset(SIDE_ROWS)) added to the wheel box's
 * centre (hero centre + VERTICAL_SHIFT). HomeWaves puts the pulse just above it.
 */
internal fun statsWheelLastRowY(): Float = HERO_HEIGHT / 2 + VERTICAL_SHIFT + offsetAt(SIDE_ROWS.toFloat())

/** All registrations (today's are filtered in the wheel), health metrics and calorie budget for the wheel. */
private suspend fun loadWheelData(): Triple<List<RegistrationDto>, List<HealthMetricDto>, Double?> = coroutineScope {
    val regs = async {
        runCatching { ApiJson.decodeFromJsonElement(RegistrationsResponse.serializer(), Api.get("/api/registrations")).registrations }.getOrNull()
    }
    val metrics = async {
        runCatching { ApiJson.decodeFromJsonElement(HealthMetricsResponse.serializer(), Api.get("/api/health-metrics")).metrics }.getOrNull()
    }
    val budget = async {
        runCatching { Api.get("/api/profile/activity?tz=${FoodTime.tzOffsetMinutesEast()}").obj("summary").obj("budget").num("budgetKcal") }.getOrNull()
    }
    val r = regs.await()
    val m = metrics.await()
    // Both lists or neither (the web's Promise.all).
    if (r == null || m == null) Triple(emptyList(), emptyList(), budget.await())
    else Triple(r, m, budget.await())
}

@Composable
fun HomeStatsWheel(side: String, modifier: Modifier = Modifier) {
    val t = LocalTranslator.current
    val density = LocalDensity.current.density
    var registrations by remember { mutableStateOf<List<RegistrationDto>>(emptyList()) }
    var metrics by remember { mutableStateOf<List<HealthMetricDto>>(emptyList()) }
    var goalKcal by remember { mutableStateOf(DAILY_KCAL_GOAL) }
    var loading by remember { mutableStateOf(true) }
    var activeIndex by remember { mutableStateOf(0) }
    var dragPixels by remember { mutableStateOf(0f) }
    var dragging by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val (r, m, budget) = loadWheelData()
        registrations = r
        metrics = m
        if (budget != null) goalKcal = budget
        loading = false
    }

    val customMeasurements = CustomMeasurePrefs.measurements
    val stats = remember(registrations, metrics, goalKcal, loading, FoodPrefs.statKeys, customMeasurements, t) {
        var totals = FrontpageTotals()
        for (item in registrations.filter { FoodTime.isToday(it.createdAt) }) {
            totals = totals.copy(
                kcal = totals.kcal + item.kcalSnapshot,
                protein = totals.protein + item.proteinSnapshot,
                carbs = totals.carbs + item.carbsSnapshot,
                fat = totals.fat + item.fatSnapshot,
                sugar = totals.sugar + (item.sugarSnapshot ?: 0.0),
                fiber = totals.fiber + (item.fiberSnapshot ?: 0.0),
                salt = totals.salt + (item.saltSnapshot ?: 0.0),
                potassium = totals.potassium + (item.potassiumSnapshot ?: 0.0),
                calcium = totals.calcium + (item.calciumSnapshot ?: 0.0),
                iron = totals.iron + (item.ironSnapshot ?: 0.0),
                saturatedFat = totals.saturatedFat + (item.saturatedFatSnapshot ?: 0.0),
                unsaturatedFat = totals.unsaturatedFat + (item.unsaturatedFatSnapshot ?: 0.0),
                transFat = totals.transFat + (item.transFatSnapshot ?: 0.0),
                cholesterol = totals.cholesterol + (item.cholesterolSnapshot ?: 0.0),
                vitaminA = totals.vitaminA + (item.vitaminASnapshot ?: 0.0),
                vitaminC = totals.vitaminC + (item.vitaminCSnapshot ?: 0.0),
            )
        }
        fun sumToday(type: String): Double? {
            val matching = metrics.filter { it.type == type && FoodTime.isToday(it.recordedAt) }
            return if (matching.isEmpty()) null else matching.sumOf { it.value }
        }
        val data = FrontpageStatData(
            totals,
            FrontpageMetrics(sumToday("STEPS"), sumToday("WATER_ML"), sumToday("ACTIVE_ENERGY_KCAL"), sumToday("DISTANCE_KM")),
            goalKcal,
        )
        val own = FoodPrefs.statKeys.mapNotNull { key -> FRONTPAGE_STAT_DEFS.firstOrNull { it.key == key } }.map { def ->
            val (value, unit) = def.compute(data)
            WheelStat(def.key, t.t(def.labelKey), def.icon, if (loading) "—" else value, unit)
        }
        val custom = if (customMeasurements.isEmpty()) emptyList() else {
            val today = FoodTime.today()
            val days = registrations.mapNotNull { item ->
                val date = FoodTime.parse(item.createdAt)?.let { FoodTime.local(it).date } ?: return@mapNotNull null
                val legacy = mapOf(
                    "sugar" to item.sugarSnapshot, "fiber" to item.fiberSnapshot, "salt" to item.saltSnapshot,
                    "potassium" to item.potassiumSnapshot, "calcium" to item.calciumSnapshot, "iron" to item.ironSnapshot,
                    "saturatedFat" to item.saturatedFatSnapshot, "unsaturatedFat" to item.unsaturatedFatSnapshot,
                    "transFat" to item.transFatSnapshot, "cholesterol" to item.cholesterolSnapshot,
                    "vitaminA" to item.vitaminASnapshot, "vitaminC" to item.vitaminCSnapshot,
                ).mapNotNull { (k, v) -> v?.let { k to it } }.toMap()
                MeasureDay(date, item.kcalSnapshot, item.proteinSnapshot, item.carbsSnapshot, item.fatSnapshot, legacy + (item.nutrientSnapshot ?: emptyMap()))
            }.groupBy { it.date }.map { (date, rows) ->
                MeasureDay(
                    date, rows.sumOf { it.kcal }, rows.sumOf { it.protein }, rows.sumOf { it.carbs }, rows.sumOf { it.fat },
                    rows.flatMap { it.nutrients.entries }.groupBy({ it.key }, { it.value }).mapValues { (_, v) -> v.sum() },
                )
            }
            val measureMetrics = metrics.mapNotNull { m ->
                FoodTime.parse(m.recordedAt)?.let { MeasureMetric(m.type, m.value, FoodTime.local(it).date, m.recordedAt) }
            }
            customMeasurements.map { measurement ->
                val (value, unit) = computeMeasurement(measurement, days, measureMetrics, goalKcal, today)
                WheelStat("custom:${measurement.id}", measurement.name, FoodIconSpec.Tabler("Ruler2"), if (loading) "—" else value, unit, measureTextLines(measurement.text))
            }
        }
        val placeholders = listOf(
            WheelStat("placeholder-sleep", "Søvn (eksempel)", FoodIconSpec.Tabler("Moon"), "7,5", "t"),
            WheelStat("placeholder-pulse", "Puls (eksempel)", FoodIconSpec.Tabler("Heartbeat"), "62", "bpm"),
        )
        val all = own + custom
        val missing = max(0, SIDE_ROWS * 2 + 1 - all.size)
        all + placeholders.take(missing)
    }

    val visibleRange = min(SIDE_ROWS, (stats.size - 1) / 2) + 0.5f
    val floatIndex = activeIndex + dragPixels / DRAG_STEP
    val heroHeight = HERO_HEIGHT
    val boxWidth = if (side == "right") 178f else 200f
    val edge = if (side == "right") 7f else 13f
    // The wheel's box is centred on the hero (+ VERTICAL_SHIFT); rows below the
    // "Dagens tilføjelser" line are clipped so they turn in behind it.
    val boxTop = heroHeight / 2 + VERTICAL_SHIFT - WHEEL_HEIGHT / 2
    val clipBottom = heroHeight + DIVIDER_BELOW_HERO - boxTop

    Box(modifier.fillMaxSize()) {
        Box(
            Modifier
                .align(if (side == "right") Alignment.TopEnd else Alignment.TopStart)
                .offset(x = (if (side == "right") -edge else edge).dp, y = boxTop.dp)
                .width(boxWidth.dp)
                .height(WHEEL_HEIGHT.dp)
                .drawWithContent {
                    clipRect(left = -4000f, top = -4000f, right = size.width + 4000f, bottom = clipBottom * density) {
                        this@drawWithContent.drawContent()
                    }
                }
                .pointerInput(stats.size) {
                    var startTotal = 0f
                    detectVerticalDragGestures(
                        onDragStart = {
                            startTotal = 0f
                            dragging = true
                        },
                        onDragEnd = {
                            val steps = (dragPixels / DRAG_STEP).roundToInt()
                            if (steps != 0) activeIndex += steps
                            dragging = false
                            dragPixels = 0f
                        },
                        onDragCancel = {
                            dragging = false
                            dragPixels = 0f
                        },
                    ) { change, dragAmount ->
                        change.consume()
                        startTotal -= dragAmount / density
                        dragPixels = startTotal
                    }
                },
        ) {
            stats.forEachIndexed { index, stat ->
                val reach = visibleRange + 1
                val offset = index - floatIndex
                val firstLap = ceil((-reach - offset) / stats.size).toInt()
                val lastLap = floor((reach - offset) / stats.size).toInt()
                for (lap in firstLap..lastLap) {
                    key("${stat.key}@$lap") {
                        val distance = offset + lap * stats.size
                        WheelItem(stat, distance, visibleRange, animate = !dragging) {
                            if (distance != 0f) activeIndex += if (distance > 0) 1 else -1
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.BoxScope.WheelItem(
    stat: WheelStat,
    distance: Float,
    visibleRange: Float,
    animate: Boolean,
    onClick: () -> Unit,
) {
    val absDistance = min(abs(distance), visibleRange)
    val isActive = absDistance < 0.05f
    val hidden = absDistance >= visibleRange
    val y = offsetAt(absDistance)
    val translateY = if (distance < 0) -y else y
    val scale = scaleAt(absDistance)
    val tilt = if (isActive) 0f else (if (distance < 0) 1f else -1f) * absDistance * TILT_PER_ROW
    val focus = max(0f, 1 - absDistance)
    val opacity = (1 - absDistance / visibleRange) * (0.7f + 0.3f * focus)
    val captionOpacity = min(1f, 2 * (1 - absDistance / visibleRange))
    val edgeY = offsetAt(visibleRange)
    val radius = (edgeY * edgeY + MAX_INSET * MAX_INSET) / (2 * MAX_INSET)
    val inset = sqrt(max(0f, radius * radius - y * y)) - (radius - MAX_INSET)

    val spec: AnimationSpec<Float> = if (animate) tween(300) else snap()
    val ty by animateFloatAsState(translateY, spec)
    val tx by animateFloatAsState(inset, spec)
    val rot by animateFloatAsState(tilt, spec)
    val sc by animateFloatAsState(scale, spec)
    val op by animateFloatAsState(opacity, spec)
    val capOp by animateFloatAsState(captionOpacity, spec)
    val foc by animateFloatAsState(focus, spec)

    Row(
        Modifier
            .align(Alignment.CenterEnd)
            .padding(end = 8.dp)
            .graphicsLayer {
                transformOrigin = TransformOrigin(1f, 0.5f)
                translationY = ty * density
                translationX = -tx * density
                rotationZ = rot
                scaleX = sc
                scaleY = sc
            }
            .clickable(
                enabled = !hidden && !isActive,
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            ),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Column(horizontalAlignment = Alignment.End) {
            Text(
                if (stat.unit.isNotEmpty()) "${stat.value} ${stat.unit}" else stat.value,
                style = HcTypeRoles.Body.style(HcColors.Black).copy(fontWeight = FontWeight.Bold, fontSize = FONT_SIZE.sp, lineHeight = FONT_SIZE.sp),
                modifier = Modifier.graphicsLayer { alpha = op },
                maxLines = 1,
            )
            val captionLines = stat.caption ?: listOf(CAPTION_PLACEHOLDER)
            captionLines.forEach { line ->
                Text(
                    line,
                    style = HcTypeRoles.Small.style(HcColors.TextSecondary),
                    modifier = Modifier.graphicsLayer { alpha = capOp },
                    maxLines = 1,
                )
            }
        }
        Box(Modifier.graphicsLayer { alpha = op }) {
            FoodIcon(stat.icon, STAT_ICON_SIZE.dp, lerp(HcColors.Black, HcColors.Green, foc), stroke = 2.2f)
        }
    }
}

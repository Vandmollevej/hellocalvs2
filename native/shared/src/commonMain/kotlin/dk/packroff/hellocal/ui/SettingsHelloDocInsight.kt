package dk.packroff.hellocal.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToLong

// Native port of src/components/hf/HelloDocInsight.tsx and
// src/components/hf/MiniChart.tsx: the Hello Doc insight (profile column +
// chart panels). Used by the owner's "Sådan ser det ud" preview and reusable
// for the doctor view /hello-doc/[token] and admin's Hello Doc. A null field
// hides its section, so the doctor only sees the categories that were shared.

@Serializable
data class SettingsHelloDocProfile(val displayName: String = "", val email: String = "")

@Serializable
data class SettingsHelloDocWeightPoint(val date: String = "", val weightKg: Double = 0.0)

@Serializable
data class SettingsHelloDocFluidPoint(val date: String = "", val valueMl: Double = 0.0)

@Serializable
data class SettingsHelloDocSleep(val defaultBedtime: String? = null, val defaultWakeTime: String? = null)

@Serializable
data class SettingsHelloDocDailyNutrition(
    val dateKey: String = "",
    val kcal: Double = 0.0,
    val vitaminA: Double = 0.0,
    val vitaminC: Double = 0.0,
    val calcium: Double = 0.0,
    val iron: Double = 0.0,
    val potassium: Double = 0.0,
)

@Serializable
data class SettingsHelloDocInsightWeight(
    val startWeightKg: Double? = null,
    val startWeightRecordedAt: String = "",
    val history: List<SettingsHelloDocWeightPoint> = emptyList(),
)

@Serializable
data class SettingsHelloDocInsightGoals(val targetWeightKg: Double? = null)

/** InsightData from HelloDocInsight.tsx (`show.food` / `show.vitamins` default to visible). */
data class SettingsHelloDocInsightData(
    val profile: SettingsHelloDocProfile? = null,
    val weight: SettingsHelloDocInsightWeight? = null,
    val goals: SettingsHelloDocInsightGoals? = null,
    val sleep: SettingsHelloDocSleep? = null,
    val dailyNutrition: List<SettingsHelloDocDailyNutrition>? = null,
    val fluidHistory: List<SettingsHelloDocFluidPoint>? = null,
    val showFood: Boolean = true,
    val showVitamins: Boolean = true,
)

private val HelloDocInsightMonths: Map<Locale, List<String>> = mapOf(
    Locale.Da to listOf("jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."),
    Locale.En to listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"),
    Locale.De to listOf("Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."),
    Locale.Fr to listOf("janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."),
    Locale.Nl to listOf("jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"),
    Locale.Sv to listOf("jan.", "feb.", "mars", "apr.", "maj", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "dec."),
    Locale.No to listOf("jan.", "feb.", "mar.", "apr.", "mai", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "des."),
)

/** formatInsightDate(): Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }). */
fun settingsHelloDocFormatDate(value: String, locale: Locale): String {
    val instant = runCatching { Instant.parse(value) }.getOrNull() ?: return value
    val date = instant.toLocalDateTime(TimeZone.currentSystemDefault()).date
    val month = (HelloDocInsightMonths[locale] ?: HelloDocInsightMonths.getValue(Locale.Da))[date.monthNumber - 1]
    return when (locale) {
        Locale.Da, Locale.De, Locale.No -> "${date.dayOfMonth}. $month ${date.year}"
        else -> "${date.dayOfMonth} $month ${date.year}"
    }
}

/** A JS number in a template string: 80 → "80", 82.5 → "82.5". */
private fun helloDocJsNumber(value: Double): String =
    if (value % 1.0 == 0.0 && abs(value) < 1e15) value.toLong().toString() else value.toString()

private fun helloDocInitials(name: String): String =
    name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.map { it.first() }.take(2).joinToString("").uppercase()

/** HelloDocInsight: profile column (hf-insight__aside hf-card) + chart grid. */
@Composable
fun SettingsHelloDocInsight(data: SettingsHelloDocInsightData, modifier: Modifier = Modifier, greeting: String? = null) {
    val t = LocalTranslator.current
    val hasFacts = data.weight != null || data.goals != null || data.sleep != null
    val shape = RoundedCornerShape(HcDimens.RadiusCard)

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
        Column(
            Modifier.fillMaxWidth().clip(shape).background(HcColors.Card, shape).padding(HcDimens.SpaceBlock),
            verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock),
        ) {
            if (greeting != null) HcText(greeting, HcTypeRoles.Body)

            val profile = data.profile
            if (profile != null) {
                Column(
                    Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline),
                ) {
                    Box(Modifier.size(96.dp).clip(CircleShape).background(HcColors.Nav), contentAlignment = Alignment.Center) {
                        HcText(helloDocInitials(profile.displayName), HcTypeRoles.PageTitle, color = HcColors.Action, align = TextAlign.Center)
                    }
                    HcText(profile.displayName, HcTypeRoles.Title, align = TextAlign.Center)
                    HcText(profile.email, HcTypeRoles.Caption, align = TextAlign.Center)
                }
            }

            if (hasFacts) {
                Column(Modifier.fillMaxWidth()) {
                    Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.Line))
                    Column(
                        Modifier.fillMaxWidth().padding(top = HcDimens.SpaceBlock),
                        verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock),
                    ) {
                        val weight = data.weight
                        if (weight != null) {
                            Column {
                                HcText(t.t("helloDoc.preview.startWeight"), HcTypeRoles.Caption)
                                HcText(weight.startWeightKg?.let { "${helloDocJsNumber(it)} kg" } ?: "—", HcTypeRoles.Body)
                                HcText(
                                    t.t("helloDoc.preview.recordedOn", "date" to settingsHelloDocFormatDate(weight.startWeightRecordedAt, t.locale)),
                                    HcTypeRoles.Caption,
                                )
                            }
                        }
                        val goals = data.goals
                        if (goals != null) {
                            Column {
                                HcText(t.t("helloDoc.preview.startGoal"), HcTypeRoles.Caption)
                                HcText(goals.targetWeightKg?.let { "${helloDocJsNumber(it)} kg" } ?: "—", HcTypeRoles.Body)
                            }
                        }
                        val sleep = data.sleep
                        if (sleep != null) {
                            Column {
                                HcText(t.t("helloDoc.preview.sleepSection"), HcTypeRoles.Caption)
                                HcText(
                                    "${t.t("helloDoc.preview.sleepBedtime")}: ${sleep.defaultBedtime ?: t.t("helloDoc.preview.sleepNotSet")}",
                                    HcTypeRoles.Body,
                                )
                                HcText(
                                    "${t.t("helloDoc.preview.sleepWakeTime")}: ${sleep.defaultWakeTime ?: t.t("helloDoc.preview.sleepNotSet")}",
                                    HcTypeRoles.Body,
                                )
                            }
                        }
                    }
                }
            }
        }

        SettingsHelloDocInsightGrid(data)
    }
}

/** InsightGrid: one panel per shared category (1 column on phones). */
@Composable
fun SettingsHelloDocInsightGrid(data: SettingsHelloDocInsightData) {
    val t = LocalTranslator.current
    val noData = t.t("helloDoc.preview.noChartData")
    val nutrition = data.dailyNutrition

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
        val weight = data.weight
        if (weight != null) {
            HelloDocInsightPanel(t.t("helloDoc.preview.weightSection")) {
                SettingsHelloDocMiniLineChart(weight.history.map { it.weightKg }, emptyLabel = noData)
            }
        }
        if (nutrition != null && data.showFood) {
            HelloDocInsightPanel(t.t("helloDoc.preview.foodSection"), footnote = "${t.t("helloDoc.preview.kcalUnit")}/dag") {
                SettingsHelloDocMiniBarChart(nutrition.map { it.kcal.roundToLong().toDouble() }, emptyLabel = noData)
            }
        }
        if (nutrition != null && data.showVitamins) {
            // Vitamin A, Vitamin C, Calcium, Jern, Kalium — summed over the period.
            val values = if (nutrition.isEmpty()) {
                emptyList()
            } else {
                listOf(
                    nutrition.sumOf { it.vitaminA },
                    nutrition.sumOf { it.vitaminC },
                    nutrition.sumOf { it.calcium },
                    nutrition.sumOf { it.iron },
                    nutrition.sumOf { it.potassium },
                ).map { it.roundToLong().toDouble() }
            }
            HelloDocInsightPanel(t.t("helloDoc.preview.vitaminsSection")) {
                SettingsHelloDocMiniBarChart(values, color = HcColors.Appbar, emptyLabel = noData)
            }
        }
        val fluid = data.fluidHistory
        if (fluid != null) {
            HelloDocInsightPanel(t.t("helloDoc.preview.fluidSection")) {
                SettingsHelloDocMiniBarChart(fluid.map { it.valueMl }, color = HcColors.Google, emptyLabel = noData)
            }
        }
    }
}

/** .hf-panel: white surface, 1 px nav border, 16 px padding, 8 px gap. */
@Composable
private fun HelloDocInsightPanel(title: String, footnote: String? = null, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(HcColors.Surface, shape).border(1.dp, HcColors.Nav, shape).padding(HcDimens.SpaceBlock),
        verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline),
    ) {
        HcText(title, HcTypeRoles.Title)
        content()
        if (footnote != null) HcText(footnote, HcTypeRoles.Caption, Modifier.fillMaxWidth(), align = TextAlign.End)
    }
}

private const val HelloDocChartWidth = 300f
private const val HelloDocChartHeight = 120f
private const val HelloDocChartPadding = 8f

/** MiniLineChart: 300×120 viewBox scaled to the full width. */
@Composable
fun SettingsHelloDocMiniLineChart(values: List<Double>, color: Color = HcColors.Brand, emptyLabel: String) {
    if (values.isEmpty()) {
        HelloDocEmptyChart(emptyLabel)
        return
    }
    Canvas(Modifier.fillMaxWidth().aspectRatio(HelloDocChartWidth / HelloDocChartHeight)) {
        val s = size.width / HelloDocChartWidth
        val min = values.min()
        val maxValue = values.max()
        val range = (maxValue - min).takeIf { it != 0.0 } ?: 1.0
        val coords = values.mapIndexed { index, value ->
            val x = if (values.size == 1) HelloDocChartWidth / 2 else HelloDocChartPadding + (index.toFloat() / (values.size - 1)) * (HelloDocChartWidth - HelloDocChartPadding * 2)
            val y = HelloDocChartHeight - HelloDocChartPadding - ((value - min) / range).toFloat() * (HelloDocChartHeight - HelloDocChartPadding * 2)
            Offset(x * s, y * s)
        }
        val path = Path().apply {
            coords.forEachIndexed { index, c -> if (index == 0) moveTo(c.x, c.y) else lineTo(c.x, c.y) }
        }
        drawPath(path, color, style = Stroke(width = 2.5f * s, cap = StrokeCap.Round, join = StrokeJoin.Round))
        coords.forEachIndexed { index, c ->
            drawCircle(color, radius = (if (index == coords.lastIndex) 3.5f else 2f) * s, center = c)
        }
    }
}

/** MiniBarChart: bars at 70 % of their slot, rounded 2 px corners. */
@Composable
fun SettingsHelloDocMiniBarChart(values: List<Double>, color: Color = HcColors.Brand, emptyLabel: String) {
    if (values.isEmpty()) {
        HelloDocEmptyChart(emptyLabel)
        return
    }
    Canvas(Modifier.fillMaxWidth().aspectRatio(HelloDocChartWidth / HelloDocChartHeight)) {
        val s = size.width / HelloDocChartWidth
        val maxValue = max(values.max(), 1.0)
        val barWidth = (HelloDocChartWidth - HelloDocChartPadding * 2) / values.size
        values.forEachIndexed { index, value ->
            val barHeight = (value / maxValue).toFloat() * (HelloDocChartHeight - HelloDocChartPadding * 2)
            val x = HelloDocChartPadding + index * barWidth
            val y = HelloDocChartHeight - HelloDocChartPadding - barHeight
            drawRoundRect(
                color = color,
                topLeft = Offset((x + barWidth * 0.15f) * s, y * s),
                size = Size(barWidth * 0.7f * s, max(barHeight, 1f) * s),
                cornerRadius = CornerRadius(2f * s, 2f * s),
            )
        }
    }
}

@Composable
private fun HelloDocEmptyChart(label: String) {
    Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
        HcText(label, HcTypeRoles.Caption, color = HcColors.TextSecondary, align = TextAlign.Center)
    }
}

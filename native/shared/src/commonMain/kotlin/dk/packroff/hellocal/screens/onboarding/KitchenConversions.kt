package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAccordionCard
import dk.packroff.hellocal.ui.HcChoiceChip
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.OnbSearchField
import dk.packroff.hellocal.ui.formatNumber
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlin.math.max
import kotlin.math.roundToInt

// --- src/lib/kitchen-conversion-units.ts + src/lib/kitchen-conversions.ts ----
// Omregningstabellen væsker (og tørvarer målt i dl) → gram, hentet én gang
// via GET /api/kitchen-conversions (kilde: src/data/kitchen-conversions.json).

@Serializable
internal data class KitchenConversionGroup(val id: String, val title: String)

@Serializable
internal data class KitchenConversion(
    val id: String,
    val group: String,
    val name: String,
    val gramsPerDl: Double,
    val keywords: List<String>,
)

@Serializable
internal data class KitchenConversionTable(val groups: List<KitchenConversionGroup>, val items: List<KitchenConversion>)

internal object KitchenConversions {
    private val mutex = Mutex()
    private var cache: KitchenConversionTable? = null

    suspend fun table(): KitchenConversionTable = mutex.withLock {
        cache ?: ApiJson.decodeFromJsonElement(KitchenConversionTable.serializer(), Api.get("/api/kitchen-conversions"))
            .also { cache = it }
    }
}

/** Danske køkkenmål i ml; "knsp" har ingen fast størrelse. */
internal val VOLUME_UNIT_ML = mapOf(
    "ml" to 1.0, "milliliter" to 1.0, "cl" to 10.0, "centiliter" to 10.0, "dl" to 100.0, "deciliter" to 100.0,
    "l" to 1000.0, "liter" to 1000.0, "spsk" to 15.0, "spsk." to 15.0, "tsk" to 5.0, "tsk." to 5.0,
)

internal fun volumeUnitMl(unit: String?): Double? = unit?.trim()?.lowercase()?.let { VOLUME_UNIT_ML[it] }

private const val LETTER = "a-zæøåäöüéèêáàíóúç"
private val keywordPatterns = mutableMapOf<String, Regex>()

private fun keywordPattern(keyword: String): Regex = keywordPatterns.getOrPut(keyword) {
    Regex("(^|[^$LETTER])${Regex.escape(keyword)}(?:ene|en|et|er|rne|e|n|r|s)?($|[^$LETTER])", RegexOption.IGNORE_CASE)
}

/** Varen hvis nøgleord passer som helt ord; det længste nøgleord vinder. */
internal fun findConversionIn(items: List<KitchenConversion>, name: String?): KitchenConversion? {
    val text = name.orEmpty().lowercase()
    if (text.isBlank()) return null
    var best: KitchenConversion? = null
    var bestLength = 0
    for (item in items) for (keyword in item.keywords) {
        if (keyword.length > bestLength && keywordPattern(keyword).containsMatchIn(text)) {
            best = item
            bestLength = keyword.length
        }
    }
    return best
}

internal fun volumeToGrams(amount: Double, unit: String?, item: KitchenConversion): Double? {
    val ml = volumeUnitMl(unit) ?: return null
    return amount * ml * item.gramsPerDl / 100.0
}

internal data class KitchenMeasure(val amount: Double, val unit: String)

/** Gram → dl fra ½ dl og op, ellers spsk, under 1 spsk tsk (afrundet til ½; dl til 0,1 under 1 dl). */
internal fun gramsToMeasure(grams: Double, item: KitchenConversion): KitchenMeasure? {
    if (grams.isNaN() || grams <= 0) return null
    val ml = grams * 100.0 / item.gramsPerDl
    if (ml >= 50) {
        val dl = ml / 100.0
        return KitchenMeasure(if (dl < 1) (dl * 10).roundToInt() / 10.0 else (dl * 2).roundToInt() / 2.0, "dl")
    }
    if (ml >= 15) return KitchenMeasure(max(1.0, (ml / 15 * 2).roundToInt() / 2.0), "spsk")
    return KitchenMeasure(max(0.5, (ml / 5 * 2).roundToInt() / 2.0), "tsk")
}

internal fun formatKitchenNumber(value: Double, decimals: Int = 1) = formatNumber(value, decimals, Locale.Da)

/** "2 dl" sødmælk → "206 g"; null når mængden ikke kan omregnes. */
internal fun measureAsGramsText(items: List<KitchenConversion>, amount: Double?, unit: String?, name: String): String? {
    if (amount == null) return null
    val item = findConversionIn(items, name) ?: return null
    val grams = volumeToGrams(amount, unit, item) ?: return null
    return "${formatKitchenNumber(grams.roundToInt().toDouble(), 0)} g"
}

/** 206 g sødmælk → "2 dl"; null når varen ikke står i tabellen. */
internal fun gramsAsMeasureText(items: List<KitchenConversion>, grams: Double, name: String): String? {
    val item = findConversionIn(items, name) ?: return null
    val measure = gramsToMeasure(grams, item) ?: return null
    return "${formatKitchenNumber(measure.amount)} ${measure.unit}"
}

// --- /viden-om/omregning ----------------------------------------------------

private val CONVERSION_UNITS = listOf("dl", "spsk", "tsk", "ml")

private fun gramsText(gramsPerDl: Double, ml: Double) = "${formatKitchenNumber((gramsPerDl * ml / 10).roundToInt() / 10.0)} g"

/**
 * Native port of src/app/viden-om/omregning/page.tsx — Viden om mad → Omregning:
 * alle væsker (og tørvarer målt i dl) omregnet til gram for en valgt mængde.
 */
@Composable
fun KnowledgeConversionScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    var table by remember { mutableStateOf<KitchenConversionTable?>(null) }
    var query by remember { mutableStateOf("") }
    var amountText by remember { mutableStateOf("1") }
    var unit by remember { mutableStateOf("dl") }
    LaunchedEffect(Unit) { table = runCatching { KitchenConversions.table() }.getOrNull() ?: KitchenConversionTable(emptyList(), emptyList()) }

    val amount = amountText.replace(",", ".").toDoubleOrNull()?.takeIf { it > 0 } ?: 0.0
    val ml = amount * (VOLUME_UNIT_ML[unit] ?: 100.0)
    val q = query.trim().lowercase()

    HcScreen(title = "Omregning: væsker til gram", icon = { HcIcon("Scale", size = 20.dp, stroke = 2f, color = HcColors.White) }, contentPadding = KnowledgePadding) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                HcTextField(amountText, { amountText = it }, Modifier.width(64.dp), keyboardType = KeyboardType.Decimal, standard = true)
                for (option in CONVERSION_UNITS) {
                    HcChoiceChip(option, unit == option, { unit = option }, Modifier.weight(1f))
                }
            }
            OnbSearchField(query, { query = it }, "Søg fx mælk, olie, honning eller mel")
            val current = table
            if (current == null) {
                HcText("Henter...", HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            } else {
                val groups = current.groups.map { group ->
                    group to current.items.filter { item ->
                        item.group == group.id && (q.isEmpty() || item.name.lowercase().contains(q) || item.keywords.any { it.contains(q) })
                    }
                }.filter { it.second.isNotEmpty() }
                if (groups.isEmpty()) HcText("Ingen resultater.", HcTypeRoles.Body, color = HcColors.TextSecondary)
                for ((group, items) in groups) {
                    Column {
                        HcText(group.title, HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), bold = true)
                        HcAccordionCard {
                            items.forEachIndexed { index, item ->
                                Row(
                                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column(Modifier.weight(1f)) {
                                        HcText(item.name, HcTypeRoles.Body)
                                        HcText(
                                            "1 dl = ${gramsText(item.gramsPerDl, 100.0)} · 1 spsk = ${gramsText(item.gramsPerDl, 15.0)} · 1 tsk = ${gramsText(item.gramsPerDl, 5.0)}",
                                            HcTypeRoles.Small,
                                            color = HcColors.TextSecondary,
                                        )
                                    }
                                    HcText(gramsText(item.gramsPerDl, ml), HcTypeRoles.Body, bold = true)
                                }
                                if (index < items.size - 1) HcLine()
                            }
                        }
                    }
                }
            }
        }
    }
}

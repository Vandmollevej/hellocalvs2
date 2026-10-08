package dk.packroff.hellocal.screens.capture

import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.ui.formatNumber
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.floor
import kotlin.math.roundToLong

/**
 * Port of src/lib/units.ts (weight part). The web keeps the unit choice in
 * localStorage "hellocal.units" (+ "hellocal.units.region"); natively the same
 * keys live in NativeHooks.secureStorage. The database always stores kg.
 */
internal enum class WeightUnit(val code: String) { Kg("kg"), Lb("lb"), St("st") }

internal object WeightUnits {
    private const val KG_PER_LB = 0.45359237
    private const val LB_PER_ST = 14

    fun current(): WeightUnit {
        val stored = NativeHooks.secureStorage.get("hellocal.units")?.let {
            runCatching { (ApiJson.parseToJsonElement(it) as? JsonObject)?.get("weight")?.jsonPrimitive?.contentOrNull }.getOrNull()
        }
        WeightUnit.entries.firstOrNull { it.code == stored }?.let { return it }
        return when (NativeHooks.secureStorage.get("hellocal.units.region")?.uppercase()) {
            "US", "CA", "LR", "MM" -> WeightUnit.Lb
            "GB", "IE" -> WeightUnit.St
            else -> WeightUnit.Kg
        }
    }

    private fun round1(value: Double) = (value * 10).roundToLong() / 10.0

    fun label(unit: WeightUnit): String = if (unit == WeightUnit.St) "st lb" else unit.code

    /** "72,5 kg", "160 lb" or "11 st 5 lb". */
    fun format(kg: Double, unit: WeightUnit, locale: Locale = Locale.Da): String {
        if (unit == WeightUnit.Kg) return "${formatNumber(kg, 1, locale, 0)} kg"
        val lb = kg / KG_PER_LB
        if (unit == WeightUnit.Lb) return "${formatNumber(lb, 1, locale, 0)} lb"
        val stones = floor(lb / LB_PER_ST).toInt()
        val rest = round1(lb - stones * LB_PER_ST)
        return if (rest >= LB_PER_ST) "${stones + 1} st 0 lb" else "$stones st ${formatNumber(rest, 1, locale, 0)} lb"
    }

    private fun plain(value: Double): String {
        val r = round1(value)
        return (if (r == floor(r)) r.toLong().toString() else r.toString()).replace(".", ",")
    }

    /** Number part for a placeholder/pre-fill ("72,5", "160", "11 5"). */
    fun toInput(kg: Double, unit: WeightUnit): String {
        if (unit == WeightUnit.Kg) return plain(kg)
        val lb = kg / KG_PER_LB
        if (unit == WeightUnit.Lb) return plain(lb)
        val stones = floor(lb / LB_PER_ST).toInt()
        val rest = round1(lb - stones * LB_PER_ST)
        return if (rest >= LB_PER_ST) "${stones + 1} 0" else "$stones ${plain(rest)}"
    }

    /** Typed weight → kg, or null (same rules as parseWeightInput). */
    fun parse(raw: String, unit: WeightUnit): Double? {
        val text = raw.trim().lowercase().replaceFirst(",", ".")
        if (text.isEmpty()) return null
        if (unit == WeightUnit.Kg || unit == WeightUnit.Lb) {
            val value = text.replace(Regex("\\s*(kg|lbs?)$"), "").toDoubleOrNull() ?: return null
            if (value <= 0 || value.isNaN() || value.isInfinite()) return null
            return if (unit == WeightUnit.Kg) value else value * KG_PER_LB
        }
        val numbers = Regex("\\d+(?:\\.\\d+)?").findAll(text).map { it.value.toDouble() }.toList()
        if (numbers.isEmpty() || numbers.size > 2) return null
        val lb = if (numbers.size == 2) numbers[0] * LB_PER_ST + numbers[1] else numbers[0] * LB_PER_ST
        return if (lb > 0) lb * KG_PER_LB else null
    }
}

package dk.packroff.hellocal.screens.profile

import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.ui.formatNumber
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.floor

// src/lib/units.ts — which units body weight and lengths are shown and typed
// in. A per-device preference (localStorage on the web, the encrypted store
// here, same keys). The database always stores kg and cm.

enum class WeightUnit(val code: String) { Kg("kg"), Lb("lb"), St("st") }

enum class HeightUnit(val code: String) { Cm("cm"), In("in") }

data class UnitPrefs(val weight: WeightUnit, val height: HeightUnit)

object ProfileUnits {
    private const val STORAGE_KEY = "hellocal.units"
    private const val REGION_STORAGE_KEY = "hellocal.units.region"
    private const val KG_PER_LB = 0.45359237
    private const val LB_PER_ST = 14.0
    private const val CM_PER_IN = 2.54

    private fun defaultsForRegion(region: String?): UnitPrefs = when ((region ?: "").uppercase()) {
        "US", "CA", "LR", "MM" -> UnitPrefs(WeightUnit.Lb, HeightUnit.In)
        "GB", "IE" -> UnitPrefs(WeightUnit.St, HeightUnit.In)
        else -> UnitPrefs(WeightUnit.Kg, HeightUnit.Cm)
    }

    /** Explicit choice, else the default for the profile's country. */
    fun current(): UnitPrefs {
        val storage = runCatching { NativeHooks.secureStorage }.getOrNull()
        val raw = runCatching { storage?.get(STORAGE_KEY) }.getOrNull()
        val region = runCatching { storage?.get(REGION_STORAGE_KEY) }.getOrNull()
        val stored = raw?.let { runCatching { Json.parseToJsonElement(it) as? JsonObject }.getOrNull() }
        val weight = stored?.get("weight")?.jsonPrimitive?.contentOrNull?.let { code -> WeightUnit.entries.firstOrNull { it.code == code } }
        val height = stored?.get("height")?.jsonPrimitive?.contentOrNull?.let { code -> HeightUnit.entries.firstOrNull { it.code == code } }
        val auto = defaultsForRegion(region)
        return UnitPrefs(weight ?: auto.weight, height ?: auto.height)
    }

    fun kgToLb(kg: Double) = kg / KG_PER_LB
    fun lbToKg(lb: Double) = lb * KG_PER_LB
    fun cmToIn(cm: Double) = cm / CM_PER_IN
    fun inToCm(inches: Double) = inches * CM_PER_IN

    fun weightUnitLabel(unit: WeightUnit): String = if (unit == WeightUnit.St) "st lb" else unit.code

    fun lengthUnitLabel(unit: HeightUnit): String = unit.code

    private fun num(value: Double, decimals: Int) = formatNumber(value, decimals, minDecimals = 0)

    /** "72,5 kg", "160 lb" or "11 st 5 lb". */
    fun formatWeight(kg: Double, unit: WeightUnit): String {
        if (unit == WeightUnit.Kg) return "${num(kg, 1)} kg"
        val lb = kgToLb(kg)
        if (unit == WeightUnit.Lb) return "${num(lb, 1)} lb"
        val stones = floor(lb / LB_PER_ST).toInt()
        val rest = round1(lb - stones * LB_PER_ST)
        return if (rest >= LB_PER_ST) "${stones + 1} st 0 lb" else "$stones st ${num(rest, 1)} lb"
    }

    /** Number part in the unit for pre-filling an input ("72,5", "160", "11 5"). */
    fun weightToInputValue(kg: Double, unit: WeightUnit): String {
        if (unit == WeightUnit.Kg) return jsNumber(round1(kg)).replace(".", ",")
        val lb = kgToLb(kg)
        if (unit == WeightUnit.Lb) return jsNumber(round1(lb)).replace(".", ",")
        val stones = floor(lb / LB_PER_ST).toInt()
        val rest = round1(lb - stones * LB_PER_ST)
        return if (rest >= LB_PER_ST) "${stones + 1} 0" else "$stones ${jsNumber(rest).replace(".", ",")}"
    }

    /** Typed weight → kg, or null. st: "11 5", "11st 5lb", "11:5"; a single number = (decimal) stones. */
    fun parseWeightInput(raw: String, unit: WeightUnit): Double? {
        val text = raw.trim().lowercase().replaceFirst(",", ".")
        if (text.isEmpty()) return null
        if (unit == WeightUnit.Kg || unit == WeightUnit.Lb) {
            val value = text.replace(Regex("\\s*(kg|lbs?)$"), "").toDoubleOrNull() ?: return null
            if (!value.isFinite() || value <= 0) return null
            return if (unit == WeightUnit.Kg) value else lbToKg(value)
        }
        val numbers = Regex("\\d+(?:\\.\\d+)?").findAll(text).map { it.value.toDouble() }.toList()
        if (numbers.isEmpty() || numbers.size > 2) return null
        val lb = if (numbers.size == 2) numbers[0] * LB_PER_ST + numbers[1] else numbers[0] * LB_PER_ST
        return if (lb > 0) lbToKg(lb) else null
    }

    /** "175 cm" or "69 in". */
    fun formatLength(cm: Double, unit: HeightUnit): String =
        if (unit == HeightUnit.Cm) "${num(cm, 1)} cm" else "${num(cmToIn(cm), 1)} in"

    /** Number part for an input in the unit ("175" / "68,9"). */
    fun lengthToInputValue(cm: Double, unit: HeightUnit): String =
        jsNumber(round1(if (unit == HeightUnit.Cm) cm else cmToIn(cm))).replace(".", ",")

    /** Typed length → cm, or null. */
    fun parseLengthInput(raw: String, unit: HeightUnit): Double? {
        if (raw.isBlank()) return null
        val value = raw.trim().lowercase().replaceFirst(",", ".").replace(Regex("\\s*(cm|in)$"), "").toDoubleOrNull() ?: return null
        if (!value.isFinite() || value <= 0) return null
        return if (unit == HeightUnit.Cm) value else inToCm(value)
    }
}

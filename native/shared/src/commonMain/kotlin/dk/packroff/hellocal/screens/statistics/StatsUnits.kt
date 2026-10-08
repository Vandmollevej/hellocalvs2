package dk.packroff.hellocal.screens.statistics

import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlin.math.floor
import kotlin.math.round

// src/lib/units.ts — which units body weight and lengths are shown in. A
// per-device choice (web: localStorage "hellocal.units"); the database always
// stores kg and cm. Until the user chooses, the default follows the profile
// region ("hellocal.units.region").
// TODO(parity): the web also falls back to the browser's region; the app has
// no such signal in common code yet, so it falls back to metric.

internal enum class WeightUnit { Kg, Lb, St }
internal enum class LengthUnit { Cm, In }

internal data class UnitPrefs(val weight: WeightUnit, val height: LengthUnit)

private const val KG_PER_LB = 0.45359237
private const val LB_PER_ST = 14.0
private const val CM_PER_IN = 2.54

private fun defaultUnitsForRegion(region: String?): UnitPrefs = when (region?.uppercase()) {
    "US", "CA", "LR", "MM" -> UnitPrefs(WeightUnit.Lb, LengthUnit.In)
    "GB", "IE" -> UnitPrefs(WeightUnit.St, LengthUnit.In)
    else -> UnitPrefs(WeightUnit.Kg, LengthUnit.Cm)
}

/** The active units: the user's explicit choice, else the region default. */
internal fun currentUnits(): UnitPrefs {
    val region = runCatching { NativeHooks.secureStorage.get("hellocal.units.region") }.getOrNull()
    val auto = defaultUnitsForRegion(region)
    val stored = runCatching {
        NativeHooks.secureStorage.get("hellocal.units")?.let { Json.parseToJsonElement(it) as? JsonObject }
    }.getOrNull()
    val weight = when (stored?.string("weight")) {
        "kg" -> WeightUnit.Kg
        "lb" -> WeightUnit.Lb
        "st" -> WeightUnit.St
        else -> auto.weight
    }
    val height = when (stored?.string("height")) {
        "cm" -> LengthUnit.Cm
        "in" -> LengthUnit.In
        else -> auto.height
    }
    return UnitPrefs(weight, height)
}

internal fun kgToLb(kg: Double): Double = kg / KG_PER_LB
internal fun cmToIn(cm: Double): Double = cm / CM_PER_IN

/** "72,5 kg", "160 lb" or "11 st 5 lb". */
internal fun formatWeight(kg: Double, unit: WeightUnit): String {
    if (unit == WeightUnit.Kg) return "${daNumber(kg, 1)} kg"
    val lb = kgToLb(kg)
    if (unit == WeightUnit.Lb) return "${daNumber(lb, 1)} lb"
    val stones = floor(lb / LB_PER_ST).toInt()
    val rest = round((lb - stones * LB_PER_ST) * 10) / 10
    return if (rest >= LB_PER_ST) "${stones + 1} st 0 lb" else "$stones st ${daNumber(rest, 1)} lb"
}

/** Height or body length: "175 cm" or "69 in". */
internal fun formatLength(cm: Double, unit: LengthUnit): String =
    if (unit == LengthUnit.Cm) "${daNumber(cm, 1)} cm" else "${daNumber(cmToIn(cm), 1)} in"

internal fun lengthUnitLabel(unit: LengthUnit): String = if (unit == LengthUnit.Cm) "cm" else "in"

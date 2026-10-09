package dk.packroff.hellocal.ui

import androidx.compose.runtime.mutableIntStateOf
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlin.math.floor
import kotlin.math.roundToLong

// src/lib/units.ts — the ONE units module of the app. Settings → Sprog og
// region → Enheder (and the guide's first step) choose which units body weight
// and height / body lengths are shown and typed in. A per-device preference:
// the web keeps it in localStorage "hellocal.units" (+ "hellocal.units.region"),
// natively the same keys live in NativeHooks.secureStorage. The database always
// stores kg and cm — this module only converts at the edge. Until the user
// chooses, the default follows the profile region, else the phone's region.

enum class WeightUnit(val code: String) {
    Kg("kg"), Lb("lb"), St("st");

    companion object {
        fun fromCode(code: String?): WeightUnit? = entries.firstOrNull { it.code == code }
    }
}

enum class HeightUnit(val code: String) {
    Cm("cm"), In("in");

    companion object {
        fun fromCode(code: String?): HeightUnit? = entries.firstOrNull { it.code == code }
    }
}

data class UnitPrefs(val weight: WeightUnit, val height: HeightUnit)

object Units {
    private const val STORAGE_KEY = "hellocal.units"
    private const val REGION_STORAGE_KEY = "hellocal.units.region"
    private const val KG_PER_LB = 0.45359237
    private const val LB_PER_ST = 14.0
    private const val CM_PER_IN = 2.54

    val DEFAULT = UnitPrefs(WeightUnit.Kg, HeightUnit.Cm)

    // Bumped on every save: reading [current] inside a composable recomposes it
    // after a change (the web's useSyncExternalStore listeners).
    private val versionState = mutableIntStateOf(0)

    /** USA/Canada/Liberia/Myanmar: lb + in. UK/Ireland: st + in. Everywhere else metric. */
    fun defaultsForRegion(region: String?): UnitPrefs = when ((region ?: "").uppercase()) {
        "US", "CA", "LR", "MM" -> UnitPrefs(WeightUnit.Lb, HeightUnit.In)
        "GB", "IE" -> UnitPrefs(WeightUnit.St, HeightUnit.In)
        else -> DEFAULT
    }

    private fun read(key: String): String? = runCatching { NativeHooks.secureStorage.get(key) }.getOrNull()

    private fun stored(): JsonObject? = read(STORAGE_KEY)?.let { runCatching { ApiJson.parseToJsonElement(it) as? JsonObject }.getOrNull() }

    private fun JsonObject.code(name: String): String? = (get(name) as? JsonPrimitive)?.contentOrNull

    /** Active weight/height units: the explicit choice, else the country default (useUnits()). */
    fun current(): UnitPrefs {
        @Suppress("UNUSED_VARIABLE") val version = versionState.intValue
        val stored = stored()
        val region = read(REGION_STORAGE_KEY) ?: runCatching { NativeHooks.deviceRegion() }.getOrNull()
        val auto = defaultsForRegion(region)
        return UnitPrefs(
            WeightUnit.fromCode(stored?.code("weight")) ?: auto.weight,
            HeightUnit.fromCode(stored?.code("height")) ?: auto.height,
        )
    }

    /** Persists an explicit unit choice (saveUnits). */
    fun save(weight: WeightUnit? = null, height: HeightUnit? = null) {
        val stored = stored()
        val w = weight ?: WeightUnit.fromCode(stored?.code("weight"))
        val h = height ?: HeightUnit.fromCode(stored?.code("height"))
        val map = buildMap<String, JsonPrimitive> {
            if (w != null) put("weight", JsonPrimitive(w.code))
            if (h != null) put("height", JsonPrimitive(h.code))
        }
        runCatching { NativeHooks.secureStorage.set(STORAGE_KEY, JsonObject(map).toString()) }
        versionState.intValue++
    }

    /** Remembers the profile region so the automatic default follows the user's country (setUnitsRegion). */
    fun setRegion(region: String?) {
        if (region.isNullOrEmpty() || read(REGION_STORAGE_KEY) == region) return
        runCatching { NativeHooks.secureStorage.set(REGION_STORAGE_KEY, region) }
        versionState.intValue++
    }

    // ---------- Conversion (storage is always kg / cm) ----------

    fun kgToLb(kg: Double) = kg / KG_PER_LB
    fun lbToKg(lb: Double) = lb * KG_PER_LB
    fun cmToIn(cm: Double) = cm / CM_PER_IN
    fun inToCm(inches: Double) = inches * CM_PER_IN

    private fun round1(value: Double) = (value * 10).roundToLong() / 10.0

    /** JS String(number) for a rounded value: "72.5", "160". */
    private fun jsString(value: Double): String = if (value == floor(value)) value.toLong().toString() else value.toString()

    private fun num(value: Double, locale: Locale) = formatNumber(value, 1, locale, minDecimals = 0)

    /** Short unit label for a weight unit, as shown next to input fields. */
    fun weightUnitLabel(unit: WeightUnit): String = if (unit == WeightUnit.St) "st lb" else unit.code

    /** Short unit label for a length unit (height and body measurements). */
    fun lengthUnitLabel(unit: HeightUnit): String = unit.code

    /** "72,5 kg", "160 lb" or "11 st 5 lb". */
    fun formatWeight(kg: Double, unit: WeightUnit, locale: Locale = Locale.Da): String {
        if (unit == WeightUnit.Kg) return "${num(kg, locale)} kg"
        val lb = kgToLb(kg)
        if (unit == WeightUnit.Lb) return "${num(lb, locale)} lb"
        val stones = floor(lb / LB_PER_ST).toInt()
        val rest = round1(lb - stones * LB_PER_ST)
        return if (rest >= LB_PER_ST) "${stones + 1} st 0 lb" else "$stones st ${num(rest, locale)} lb"
    }

    /** Just the number part in the unit, for pre-filling an input ("72,5", "160", "11 5"). */
    fun weightToInputValue(kg: Double, unit: WeightUnit): String {
        if (unit == WeightUnit.Kg) return jsString(round1(kg)).replace(".", ",")
        val lb = kgToLb(kg)
        if (unit == WeightUnit.Lb) return jsString(round1(lb)).replace(".", ",")
        val stones = floor(lb / LB_PER_ST).toInt()
        val rest = round1(lb - stones * LB_PER_ST)
        return if (rest >= LB_PER_ST) "${stones + 1} 0" else "$stones ${jsString(rest).replace(".", ",")}"
    }

    /**
     * Typed weight → kg, or null when it can't be read. kg/lb: one number (comma
     * or dot decimal). st: "11 5", "11st 5lb", "11:5" = stones + pounds; a single
     * number is read as (decimal) stones.
     */
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

    /** Height or body length: "175 cm" or "69 in". */
    fun formatLength(cm: Double, unit: HeightUnit, locale: Locale = Locale.Da): String =
        if (unit == HeightUnit.Cm) "${num(cm, locale)} cm" else "${num(cmToIn(cm), locale)} in"

    /** Number part for pre-filling an input in the unit ("175" / "68,9"). */
    fun lengthToInputValue(cm: Double, unit: HeightUnit): String =
        jsString(round1(if (unit == HeightUnit.Cm) cm else cmToIn(cm))).replace(".", ",")

    /** Typed length → cm, or null. */
    fun parseLengthInput(raw: String, unit: HeightUnit): Double? {
        if (raw.isBlank()) return null
        val value = raw.trim().lowercase().replaceFirst(",", ".").replace(Regex("\\s*(cm|in)$"), "").toDoubleOrNull() ?: return null
        if (!value.isFinite() || value <= 0) return null
        return if (unit == HeightUnit.Cm) value else inToCm(value)
    }
}

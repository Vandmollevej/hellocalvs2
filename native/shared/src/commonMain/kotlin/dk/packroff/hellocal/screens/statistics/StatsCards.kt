package dk.packroff.hellocal.screens.statistics

import kotlin.math.max
import kotlin.math.round

// src/lib/stat-cards.ts — the stat cards the user can assemble on the
// Statistics page. Labels are the web's hard-coded Danish labels.

/** Card icon: a Tabler icon name, or one of the custom icons below. */
internal const val ICON_DRUMSTICK = "custom:drumstick"
internal const val ICON_WATER_GLASS = "custom:waterGlass"

internal class CardUncertainty(val estimated: Double?, val tolerance: Double?, val unit: String, val digits: Int)

internal class StatCardValue(
    val key: String,
    val label: String,
    val icon: String,
    /** Image icon from public/ (minerals, vitamins, animals) — wins over [icon]. */
    val iconSrc: String?,
    val value: String,
    val loading: Boolean = false,
    /** Never set yet (no validated evaluator exists) — see stat-cards.ts. */
    val outsideRecommendedRange: Boolean = false,
    val uncertainty: CardUncertainty? = null,
) {
    fun withValue(value: String, loading: Boolean) =
        StatCardValue(key, label, icon, iconSrc, value, loading, outsideRecommendedRange, uncertainty)
}

internal class StatCardData(
    val days: List<DailyTotal>,
    /** Only when at least one real integration is CONNECTED. */
    val activities: List<StatActivity>?,
    val metrics: List<StatMetric>,
    /** Null = still loading ("—"). */
    val sources: List<StatRegistration>?,
)

private class StatCardDef(val key: String, val label: String, val icon: String, val iconSrc: String? = null, val compute: (StatCardData) -> String)

private fun average(days: List<DailyTotal>, pick: (DailyTotal) -> Double): Double =
    if (days.isEmpty()) 0.0 else days.sumOf(pick) / days.size

private fun averageMetric(metrics: List<StatMetric>, type: String): Double? {
    val matching = metrics.filter { it.type == type }
    return if (matching.isEmpty()) null else matching.sumOf { it.value } / matching.size
}

private fun metricValue(data: StatCardData, type: String, unit: String = "", digits: Int = 0): String {
    val avg = averageMetric(data.metrics, type) ?: return "—"
    val formatted = daNumber(avg, digits)
    return if (unit.isNotEmpty()) "$formatted $unit" else formatted
}

private fun latestMetric(metrics: List<StatMetric>, type: String): Double? =
    metrics.filter { it.type == type }.maxByOrNull { it.recordedAtMillis }?.value

private fun latestValue(data: StatCardData, type: String, unit: String = "", digits: Int = 1): String {
    val value = latestMetric(data.metrics, type) ?: return "—"
    val formatted = daNumber(value, digits)
    return if (unit.isNotEmpty()) "$formatted $unit" else formatted
}

private fun bloodPressure(data: StatCardData): String {
    val systolic = latestMetric(data.metrics, "BLOOD_PRESSURE_SYSTOLIC_MMHG")
    val diastolic = latestMetric(data.metrics, "BLOOD_PRESSURE_DIASTOLIC_MMHG")
    if (systolic == null || diastolic == null) return "—"
    return "${daNumber(systolic)}/${daNumber(diastolic)} mmHg"
}

private fun meatCard(type: String, grams: Boolean): (StatCardData) -> String = { data ->
    val sources = data.sources
    if (sources == null) "—" else {
        val total = meatTotals(sources)[type] ?: MeatTotal()
        if (grams) formatGrams(total.grams) else "${formatAmount(total.kcal)} kcal"
    }
}

private fun alcoholCard(field: String): (StatCardData) -> String = { data ->
    val sources = data.sources
    if (sources == null) "—" else {
        val totals = alcoholTotals(sources)
        when (field) {
            "kcal" -> "${formatAmount(totals.kcal)} kcal"
            "units" -> "${formatAmount(totals.units, 1)} genst."
            else -> formatVolume(totals.volumeMl)
        }
    }
}

private fun metricHoursMinutes(data: StatCardData, type: String): String {
    val avg = averageMetric(data.metrics, type) ?: return "—"
    val minutes = max(0, round(avg).toInt())
    val hours = minutes / 60
    val rest = minutes % 60
    return if (hours > 0) "$hours t $rest min" else "$rest min"
}

private fun minuteOfDay(data: StatCardData, type: String): String {
    val avg = averageMetric(data.metrics, type) ?: return "—"
    return formatMinutesOfDay(avg)
}

private fun daily(days: List<DailyTotal>, pick: (DailyTotal) -> Double, digits: Int, unit: String) =
    "${daNumber(average(days, pick), digits)} $unit"

private const val A = "Activity"

private val STAT_CARD_DEFS: List<StatCardDef> = listOf(
    StatCardDef("calories", "Kalorier", ICON_DRUMSTICK) { daily(it.days, { d -> d.kcal }, 0, "kcal") },
    StatCardDef("protein", "Protein", "Egg") { daily(it.days, { d -> d.protein }, 0, "g") },
    StatCardDef("carbs", "Kulhydrat", "ToolsKitchen2") { daily(it.days, { d -> d.carbs }, 0, "g") },
    StatCardDef("fat", "Fedt", "Droplet") { daily(it.days, { d -> d.fat }, 0, "g") },
    StatCardDef("sugar", "Sukker", "Candy") { daily(it.days, { d -> d.field("sugar") }, 1, "g") },
    StatCardDef("fiber", "Kostfibre", "Leaf") { daily(it.days, { d -> d.field("fiber") }, 1, "g") },
    StatCardDef("salt", "Salt", "Salt") { daily(it.days, { d -> d.field("salt") }, 1, "g") },
    StatCardDef("potassium", "Kalium", "Apple", "/icons/minerals/potassium.png") { daily(it.days, { d -> d.field("potassium") }, 0, "mg") },
    StatCardDef("calcium", "Calcium", "Bone", "/icons/minerals/calcium.png") { daily(it.days, { d -> d.field("calcium") }, 0, "mg") },
    StatCardDef("iron", "Jern", "Atom2", "/icons/minerals/iron.png") { daily(it.days, { d -> d.field("iron") }, 1, "mg") },
    StatCardDef("sodium", "Natrium", "Atom2", "/icons/minerals/sodium.png") { metricValue(it, "SODIUM_MG", "mg") },
    StatCardDef("magnesium", "Magnesium", "Atom2", "/icons/minerals/magnesium.png") { metricValue(it, "MAGNESIUM_MG", "mg") },
    StatCardDef("zinc", "Zink", "Atom2", "/icons/minerals/zinc.png") { metricValue(it, "ZINC_MG", "mg", 1) },
    StatCardDef("copper", "Kobber", "Atom2", "/icons/minerals/copper.png") { metricValue(it, "COPPER_MG", "mg", 1) },
    StatCardDef("manganese", "Mangan", "Atom2", "/icons/minerals/manganese.png") { metricValue(it, "MANGANESE_MG", "mg", 1) },
    StatCardDef("selenium", "Selen", "Atom2", "/icons/minerals/selenium.png") { metricValue(it, "SELENIUM_UG", "µg") },
    StatCardDef("phosphorus", "Fosfor", "Atom2", "/icons/minerals/phosphorus.png") { metricValue(it, "PHOSPHORUS_MG", "mg") },
    StatCardDef("iodine", "Jod", "Atom2", "/icons/minerals/iodine.png") { metricValue(it, "IODINE_UG", "µg") },
    StatCardDef("chromium", "Krom", "Atom2", "/icons/minerals/chromium.png") { metricValue(it, "CHROMIUM_UG", "µg") },
    StatCardDef("molybdenum", "Molybdæn", "Atom2", "/icons/minerals/molybdenum.png") { metricValue(it, "MOLYBDENUM_UG", "µg") },
    StatCardDef("chloride", "Klorid", "Atom2", "/icons/minerals/chloride.png") { metricValue(it, "CHLORIDE_MG", "mg") },
    StatCardDef("fluoride", "Fluorid", "Atom2", "/icons/minerals/fluoride.png") { metricValue(it, "FLUORIDE_MG", "mg", 1) },
    StatCardDef("saturatedFat", "Mættet fedt", "AlertTriangle") { daily(it.days, { d -> d.field("saturatedFat") }, 1, "g") },
    StatCardDef("unsaturatedFat", "Umættet fedt", "Droplet") { daily(it.days, { d -> d.field("unsaturatedFat") }, 1, "g") },
    StatCardDef("transFat", "Transfedt", "AlertTriangle") { daily(it.days, { d -> d.field("transFat") }, 2, "g") },
    StatCardDef("cholesterol", "Kolesterol", "Heartbeat") { daily(it.days, { d -> d.field("cholesterol") }, 0, "mg") },
    StatCardDef("vitaminA", "Vitamin A", "Carrot", "/icons/vitamins/vitamin-a.png") { daily(it.days, { d -> d.field("vitaminA") }, 0, "µg") },
    StatCardDef("vitaminC", "Vitamin C", "Lemon2", "/icons/vitamins/vitamin-c.png") { daily(it.days, { d -> d.field("vitaminC") }, 0, "mg") },
    StatCardDef("vitaminD", "Vitamin D", "Lemon2", "/icons/vitamins/vitamin-d.png") { metricValue(it, "VITAMIN_D_UG", "µg", 1) },
    StatCardDef("vitaminE", "Vitamin E", "Lemon2", "/icons/vitamins/vitamin-e.png") { metricValue(it, "VITAMIN_E_MG", "mg", 1) },
    StatCardDef("vitaminK", "Vitamin K", "Lemon2", "/icons/vitamins/vitamin-k.png") { metricValue(it, "VITAMIN_K_UG", "µg") },
    StatCardDef("vitaminB1", "Vitamin B1", "Lemon2", "/icons/vitamins/vitamin-b1.png") { metricValue(it, "VITAMIN_B1_MG", "mg", 1) },
    StatCardDef("vitaminB2", "Vitamin B2", "Lemon2", "/icons/vitamins/vitamin-b2.png") { metricValue(it, "VITAMIN_B2_MG", "mg", 1) },
    StatCardDef("vitaminB3", "Vitamin B3", "Lemon2", "/icons/vitamins/vitamin-b3.png") { metricValue(it, "VITAMIN_B3_MG", "mg", 1) },
    StatCardDef("vitaminB5", "Vitamin B5", "Lemon2", "/icons/vitamins/vitamin-b5.png") { metricValue(it, "VITAMIN_B5_MG", "mg", 1) },
    StatCardDef("vitaminB6", "Vitamin B6", "Lemon2", "/icons/vitamins/vitamin-b6.png") { metricValue(it, "VITAMIN_B6_MG", "mg", 1) },
    StatCardDef("vitaminB7", "Vitamin B7", "Lemon2", "/icons/vitamins/vitamin-b7.png") { metricValue(it, "VITAMIN_B7_UG", "µg") },
    StatCardDef("vitaminB9", "Vitamin B9", "Lemon2", "/icons/vitamins/vitamin-b9.png") { metricValue(it, "VITAMIN_B9_UG", "µg") },
    StatCardDef("vitaminB12", "Vitamin B12", "Lemon2", "/icons/vitamins/vitamin-b12.png") { metricValue(it, "VITAMIN_B12_UG", "µg", 1) },
    // Allergener, E-numre og toksiner har intet registrerings-snapshot endnu.
    StatCardDef("allergens", "Allergener", A) { "—" },
    StatCardDef("additives", "E-numre", A) { "—" },
    StatCardDef("beefGrams", "Oksekød", "Meat", "/icons/animals/cow.png", meatCard("BEEF", true)),
    StatCardDef("beefKcal", "Oksekød (kcal)", "Meat", "/icons/animals/cow.png", meatCard("BEEF", false)),
    StatCardDef("porkGrams", "Grisekød", "Pig", "/icons/animals/pig.png", meatCard("PORK", true)),
    StatCardDef("porkKcal", "Grisekød (kcal)", "Pig", "/icons/animals/pig.png", meatCard("PORK", false)),
    StatCardDef("poultryGrams", "Fjerkræ", "Feather", "/icons/animals/chicken.png", meatCard("POULTRY", true)),
    StatCardDef("poultryKcal", "Fjerkræ (kcal)", "Feather", "/icons/animals/chicken.png", meatCard("POULTRY", false)),
    StatCardDef("fishGrams", "Fisk", "Fish", "/icons/animals/fish.png", meatCard("FISH", true)),
    StatCardDef("fishKcal", "Fisk (kcal)", "Fish", "/icons/animals/fish.png", meatCard("FISH", false)),
    StatCardDef("sugaryDrinks", "Sukkerholdige drikke", "Bottle") { data ->
        data.sources?.let { "${formatAmount(sugaryDrinkKcal(it))} kcal" } ?: "—"
    },
    StatCardDef("alcoholKcal", "Alkohol", "Beer", compute = alcoholCard("kcal")),
    StatCardDef("alcoholUnits", "Alkohol (genstande)", "GlassCocktail", compute = alcoholCard("units")),
    StatCardDef("alcoholVolume", "Alkohol (mængde)", "Beer", compute = alcoholCard("volume")),
    StatCardDef("toxins", "Toksiner", "AlertTriangle") { "—" },
    StatCardDef("daysLogged", "Dage logget", "TargetArrow") { "${it.days.size}" },
    StatCardDef("goalsMet", "Mål nået", "TargetArrow") { data -> "${data.days.count { it.kcal > 0 && it.kcal <= DAILY_KCAL_GOAL }} dage" },
    StatCardDef("steps", "Skridt", "Walk") { metricValue(it, "STEPS") },
    StatCardDef("water", "Vand", ICON_WATER_GLASS) { data ->
        // (avg / 1000).toFixed(1).replace(".", ",")
        averageMetric(data.metrics, "WATER_ML")?.let { avg -> "${jsFixed1(avg / 1000)} l" } ?: "—"
    },
    StatCardDef("burned", "Forbrændt", "Flame") { metricValue(it, "ACTIVE_ENERGY_KCAL", "kcal") },
    StatCardDef("distanceKm", "Kilometer", "Route") { metricValue(it, "DISTANCE_KM", "km", 1) },
    StatCardDef("exerciseMinutes", "Aktive minutter", A) { metricValue(it, "EXERCISE_MINUTES", "min") },
    StatCardDef("standMinutes", "Aktive timer", A) { metricHoursMinutes(it, "STAND_MINUTES") },
    StatCardDef("floorsClimbed", "Etager", A) { metricValue(it, "FLOORS_CLIMBED") },
    StatCardDef("activeZoneMinutes", "Zoneminutter", "TargetArrow") { metricValue(it, "ACTIVE_ZONE_MINUTES", "min") },
    StatCardDef("heartRate", "Puls", "Heartbeat") { metricValue(it, "HEART_RATE_BPM", "bpm") },
    StatCardDef("restingHeartRate", "Hvilepuls", "Heartbeat") { metricValue(it, "RESTING_HEART_RATE_BPM", "bpm") },
    StatCardDef("restingHeartRateMinutes", "Tid med hvilepuls", "Heartbeat") { metricValue(it, "RESTING_HEART_RATE_MINUTES", "min") },
    StatCardDef("heartRateMin", "Laveste puls", "Heartbeat") { metricValue(it, "HEART_RATE_MIN_BPM", "bpm") },
    StatCardDef("heartRateMax", "Højeste puls", "Heartbeat") { metricValue(it, "HEART_RATE_MAX_BPM", "bpm") },
    StatCardDef("hrv", "HRV", "Heartbeat") { metricValue(it, "HEART_RATE_VARIABILITY_MS", "ms", 1) },
    StatCardDef("vo2Max", "VO₂ max", "Heartbeat") { metricValue(it, "VO2_MAX", "ml/kg/min", 1) },
    StatCardDef("heartRateRecovery", "Pulsrestitution", "Heartbeat") { metricValue(it, "HEART_RATE_RECOVERY_BPM", "bpm") },
    StatCardDef("respiratoryRate", "Vejrtrækningsfrekvens", A) { metricValue(it, "RESPIRATORY_RATE_BPM", "/min", 1) },
    StatCardDef("spo2", "SpO₂", A) { metricValue(it, "OXYGEN_SATURATION_PERCENT", "%", 1) },
    StatCardDef("temperature", "Temperatur", A) { metricValue(it, "TEMPERATURE_C", "°C", 1) },
    StatCardDef("stress", "Stress", A) { metricValue(it, "STRESS_SCORE") },
    StatCardDef("edaResponses", "EDA-responser", A) { metricValue(it, "EDA_RESPONSES") },
    StatCardDef("cardioLoad", "Cardio load", A) { metricValue(it, "CARDIO_LOAD", "", 1) },
    StatCardDef("sleepDuration", "Søvntid", A) { metricHoursMinutes(it, "SLEEP_MINUTES") },
    StatCardDef("sleepInBed", "Tid i seng", A) { metricHoursMinutes(it, "SLEEP_IN_BED_MINUTES") },
    StatCardDef("sleepBedtime", "Sengetid", A) { minuteOfDay(it, "SLEEP_START_MINUTE_OF_DAY") },
    StatCardDef("sleepWakeTime", "Opvågning", A) { minuteOfDay(it, "SLEEP_END_MINUTE_OF_DAY") },
    StatCardDef("sleepAwake", "Vågen", A) { metricValue(it, "SLEEP_AWAKE_MINUTES", "min") },
    StatCardDef("sleepRem", "REM-søvn", A) { metricValue(it, "SLEEP_REM_MINUTES", "min") },
    StatCardDef("sleepLight", "Let/Core-søvn", A) { metricValue(it, "SLEEP_LIGHT_MINUTES", "min") },
    StatCardDef("sleepDeep", "Dyb søvn", A) { metricValue(it, "SLEEP_DEEP_MINUTES", "min") },
    StatCardDef("sleepScore", "Søvnkvalitet", A) { metricValue(it, "SLEEP_SCORE") },
    StatCardDef("sleepEfficiency", "Søvneffektivitet", A) { metricValue(it, "SLEEP_EFFICIENCY_PERCENT", "%", 1) },
    StatCardDef("sleepAwakenings", "Opvågninger", A) { metricValue(it, "SLEEP_AWAKENINGS") },
    StatCardDef("bodyFatPercent", "Fedtprocent", "Droplet") { latestValue(it, "BODY_FAT_PERCENT", "%") },
    StatCardDef("fatMass", "Fedtmasse", "Droplet") { latestValue(it, "FAT_MASS_KG", "kg") },
    StatCardDef("fatFreeMass", "Fedtfri masse", A) { latestValue(it, "FAT_FREE_MASS_KG", "kg") },
    StatCardDef("muscleMass", "Muskelmasse", A) { latestValue(it, "MUSCLE_MASS_KG", "kg") },
    StatCardDef("skeletalMuscleMass", "Skeletmuskelmasse", A) { latestValue(it, "SKELETAL_MUSCLE_MASS_KG", "kg") },
    StatCardDef("boneMass", "Knoglemasse", "Bone") { latestValue(it, "BONE_MASS_KG", "kg") },
    StatCardDef("bodyWater", "Kropsvand", ICON_WATER_GLASS) { latestValue(it, "BODY_WATER_PERCENT", "%") },
    StatCardDef("extracellularWater", "Ekstracellulært vand", ICON_WATER_GLASS) { latestValue(it, "EXTRACELLULAR_WATER_KG", "kg") },
    StatCardDef("intracellularWater", "Intracellulært vand", ICON_WATER_GLASS) { latestValue(it, "INTRACELLULAR_WATER_KG", "kg") },
    StatCardDef("visceralFat", "Visceralt fedt", "Droplet") { latestValue(it, "VISCERAL_FAT_INDEX") },
    StatCardDef("proteinPercent", "Proteinandel", "Egg") { latestValue(it, "PROTEIN_PERCENT", "%") },
    StatCardDef("bmr", "Hvilestofskifte (BMR)", "Flame") { latestValue(it, "BASAL_METABOLIC_RATE_KCAL", "kcal", 0) },
    StatCardDef("metabolicAge", "Metabolisk alder", A) { latestValue(it, "METABOLIC_AGE_YEARS", "år", 0) },
    StatCardDef("bmi", "BMI", A) { latestValue(it, "BMI") },
    StatCardDef("height", "Højde", A) { latestValue(it, "HEIGHT_CM", "cm", 0) },
    StatCardDef("bloodPressure", "Blodtryk", "Heartbeat", compute = ::bloodPressure),
    StatCardDef("pulseWaveVelocity", "Pulsbølgehastighed", "Heartbeat") { latestValue(it, "PULSE_WAVE_VELOCITY_M_S", "m/s") },
    StatCardDef("vascularAge", "Karalder", "Heartbeat") { latestValue(it, "VASCULAR_AGE_YEARS", "år", 0) },
    StatCardDef("fitnessAge", "Fitnessalder", "Heartbeat") { latestValue(it, "FITNESS_AGE_YEARS", "år", 0) },
    StatCardDef("ecgQrs", "EKG: QRS", "Heartbeat") { latestValue(it, "QRS_INTERVAL_MS", "ms", 0) },
    StatCardDef("ecgPr", "EKG: PR", "Heartbeat") { latestValue(it, "PR_INTERVAL_MS", "ms", 0) },
    StatCardDef("ecgQt", "EKG: QT", "Heartbeat") { latestValue(it, "QT_INTERVAL_MS", "ms", 0) },
    StatCardDef("ecgQtc", "EKG: QTc", "Heartbeat") { latestValue(it, "QTC_INTERVAL_MS", "ms", 0) },
    StatCardDef("recoveryScore", "Restitution", "Heartbeat") { metricValue(it, "RECOVERY_SCORE", "%") },
    StatCardDef("strain", "Belastning (strain)", A) { metricValue(it, "STRAIN_SCORE", "", 1) },
    StatCardDef("skinTemperature", "Hudtemperatur", A) { metricValue(it, "SKIN_TEMPERATURE_C", "°C", 1) },
    StatCardDef("bloodGlucose", "Blodsukker", A) { metricValue(it, "BLOOD_GLUCOSE_MMOL_L", "mmol/l", 1) },
    StatCardDef("nerveHealth", "Nervesundhed", A) { latestValue(it, "NERVE_HEALTH_SCORE", "", 0) },
    StatCardDef("skinConductance", "Hudledningsevne", A) { latestValue(it, "SKIN_CONDUCTANCE_US", "µS") },
)

private fun jsFixed1(value: Double): String {
    val tenths = round(value * 10).toLong()
    val sign = if (tenths < 0) "-" else ""
    val abs = kotlin.math.abs(tenths)
    return "$sign${abs / 10},${abs % 10}"
}

/** "Dagsgrafens navn = det tilsvarende statistik-korts navn" (stat-charts.ts dailyChartLabel). */
internal fun statCardLabel(key: String): String = STAT_CARD_DEFS.firstOrNull { it.key == key }?.label ?: key

internal val BODY_STAT_KEYS = listOf(
    "bodyFatPercent", "fatMass", "fatFreeMass", "muscleMass", "skeletalMuscleMass", "boneMass", "bodyWater",
    "extracellularWater", "intracellularWater", "visceralFat", "proteinPercent", "bmr", "metabolicAge", "bmi", "height",
)

internal val HEART_HEALTH_STAT_KEYS = listOf(
    "bloodPressure", "pulseWaveVelocity", "vascularAge", "fitnessAge", "ecgQrs", "ecgPr", "ecgQt", "ecgQtc",
    "recoveryScore", "strain", "skinTemperature", "bloodGlucose", "nerveHealth", "skinConductance",
)

internal val DEFAULT_ACTIVE_STAT_KEYS = listOf(
    "calories", "protein", "carbs", "fat", "beefGrams", "porkGrams", "poultryGrams", "fishGrams",
    "sugaryDrinks", "alcoholKcal", "daysLogged", "goalsMet", "steps", "water", "burned",
)

internal const val SPORT_STAT_KEY_PREFIX = "sport:"

internal val FOOD_SOURCE_STAT_KEYS = listOf(
    "beefGrams", "beefKcal", "porkGrams", "porkKcal", "poultryGrams", "poultryKcal",
    "fishGrams", "fishKcal", "sugaryDrinks", "alcoholKcal", "alcoholUnits", "alcoholVolume",
)

internal const val STAT_WINDOW_DAYS = 30

private val PINNED_SPORT_TYPES = listOf("running", "cycling", "swimming", "cardio", "ski")

private fun computeSportStatCards(activities: List<StatActivity>): List<StatCardValue> {
    val bySport = LinkedHashMap<String, Pair<Double, Double>>()
    for (a in activities) {
        val (minutes, kcal) = bySport[a.sportType] ?: (0.0 to 0.0)
        bySport[a.sportType] = (minutes + a.durationMinutes) to (kcal + a.caloriesBurned)
    }
    val ordered = PINNED_SPORT_TYPES + bySport.keys.filter { it !in PINNED_SPORT_TYPES }
    return ordered.map { sportType ->
        val totals = bySport[sportType]
        val meta = sportMeta(sportType)
        StatCardValue(
            key = "$SPORT_STAT_KEY_PREFIX$sportType",
            label = meta.first,
            icon = meta.second,
            iconSrc = null,
            value = if (totals != null) "${daNumber(totals.first)} min · ${daNumber(totals.second)} kcal" else "—",
        )
    }
}

/** Nutrient cards use the registrations' nutrient snapshots when any exist for the key. */
private fun nutrientCard(def: StatCardDef, data: StatCardData, fallback: String): StatCardValue {
    val nutrient = NUTRIENT_BY_KEY.getValue(def.key)
    if (data.days.none { it.nutrients.containsKey(def.key) }) {
        return StatCardValue(def.key, def.label, def.icon, def.iconSrc, fallback)
    }
    val estimated = average(data.days) { it.nutrientsEstimated[def.key] ?: 0.0 }
    val tolerance = average(data.days) { it.nutrientsTolerance[def.key] ?: 0.0 }
    return StatCardValue(
        key = def.key,
        label = def.label,
        icon = def.icon,
        iconSrc = def.iconSrc,
        value = "${daNumber(average(data.days) { it.nutrients[def.key] ?: 0.0 }, nutrient.digits)} ${nutrient.unit}",
        uncertainty = if (estimated > 0 || tolerance > 0) {
            CardUncertainty(estimated.takeIf { it > 0 }, tolerance.takeIf { it > 0 }, nutrient.unit, nutrient.digits)
        } else null,
    )
}

internal fun computeStatCards(data: StatCardData): List<StatCardValue> {
    val staticCards = STAT_CARD_DEFS.map { def ->
        val value = def.compute(data)
        if (NUTRIENT_BY_KEY.containsKey(def.key)) nutrientCard(def, data, value)
        else StatCardValue(def.key, def.label, def.icon, def.iconSrc, value)
    }
    val sportCards = data.activities?.let { computeSportStatCards(it) }.orEmpty()
    return staticCards + sportCards
}

// ---------- Sport types (src/lib/sport-icons.ts + src/lib/activity-met.ts labels) ----------

private val SPORTS: Map<String, Pair<String, String>> = listOf(
    Triple("running", "Løb", "Run"),
    Triple("cycling", "Cykling", "Bike"),
    Triple("walking", "Gang", "Walk"),
    Triple("swimming", "Svømning", "Swimming"),
    Triple("cardio", "Cardio", "Heartbeat"),
    Triple("ski", "Ski (alpint)", "Snowflake"),
    Triple("strength", "Styrketræning", "Barbell"),
    Triple("yoga", "Yoga", "Yoga"),
    Triple("football", "Fodbold", "BallFootball"),
    Triple("other", "Anden aktivitet", "Activity"),
    Triple("trail_running", "Trailløb", "Run"),
    Triple("treadmill", "Løbebånd", "Treadmill"),
    Triple("orienteering", "Orienteringsløb", "Run"),
    Triple("obstacle_race", "Forhindringsløb", "Run"),
    Triple("nordic_walking", "Stavgang", "Trekking"),
    Triple("hiking", "Vandring", "Mountain"),
    Triple("dog_walking", "Gåtur med hund", "Dog"),
    Triple("stair_climbing", "Trappeløb", "StairsUp"),
    Triple("climbing", "Klatring", "Mountain"),
    Triple("spinning", "Spinning", "Bike"),
    Triple("mountain_biking", "Mountainbike", "Bike"),
    Triple("ebike", "Elcykel", "Bike"),
    Triple("open_water", "Svømning i åbent vand", "Swimming"),
    Triple("aqua_fitness", "Vandgymnastik", "Pool"),
    Triple("water_polo", "Vandpolo", "Swimming"),
    Triple("rowing", "Roning", "Kayak"),
    Triple("rowing_machine", "Romaskine", "Kayak"),
    Triple("kayaking", "Kajak", "Kayak"),
    Triple("canoeing", "Kano", "Kayak"),
    Triple("sup", "Stand up paddle", "Kayak"),
    Triple("surfing", "Surfing", "WaveSine"),
    Triple("windsurfing", "Wind- og kitesurfing", "Sailboat"),
    Triple("handball", "Håndbold", "PlayHandball"),
    Triple("basketball", "Basketball", "BallBasketball"),
    Triple("volleyball", "Volleyball", "BallVolleyball"),
    Triple("floorball", "Floorball", "Activity"),
    Triple("ice_hockey", "Ishockey", "IceSkating"),
    Triple("rugby", "Rugby", "Activity"),
    Triple("ultimate", "Ultimate frisbee", "Disc"),
    Triple("tennis", "Tennis", "BallTennis"),
    Triple("padel", "Padel", "BallTennis"),
    Triple("badminton", "Badminton", "BallTennis"),
    Triple("squash", "Squash", "BallTennis"),
    Triple("table_tennis", "Bordtennis", "PingPong"),
    Triple("golf", "Golf", "Golf"),
    Triple("hiit", "HIIT / intervaltræning", "Heartbeat"),
    Triple("circuit", "Cirkeltræning", "Heartbeat"),
    Triple("crossfit", "CrossFit", "Barbell"),
    Triple("bootcamp", "Bootcamp", "Barbell"),
    Triple("kettlebell", "Kettlebell", "Barbell"),
    Triple("bodyweight", "Kropsvægtstræning", "Gymnastics"),
    Triple("elliptical", "Crosstrainer", "Heartbeat"),
    Triple("jump_rope", "Sjippetov", "JumpRope"),
    Triple("trampoline", "Trampolin", "Gymnastics"),
    Triple("aerobics", "Aerobic", "Heartbeat"),
    Triple("pilates", "Pilates", "Stretching"),
    Triple("dance", "Dans", "Music"),
    Triple("zumba", "Zumba", "Music"),
    Triple("ballet", "Ballet", "Music"),
    Triple("boxing", "Boksning", "Karate"),
    Triple("kickboxing", "Kickboksning", "Karate"),
    Triple("martial_arts", "Kampsport", "Karate"),
    Triple("wrestling", "Brydning", "Karate"),
    Triple("fencing", "Fægtning", "Swords"),
    Triple("cross_country_ski", "Langrend", "Snowflake"),
    Triple("snowboard", "Snowboard", "Snowboarding"),
    Triple("ice_skating", "Skøjteløb", "IceSkating"),
    Triple("snow_shoveling", "Snerydning", "Shovel"),
    Triple("inline_skating", "Rulleskøjter", "Skateboarding"),
    Triple("skateboarding", "Skateboard", "Skateboarding"),
    Triple("horse_riding", "Ridning", "Horse"),
    Triple("gardening", "Havearbejde", "Plant"),
    Triple("woodcutting", "Brændehugning", "Axe"),
    Triple("moving", "Flytning / bære tungt", "Box"),
    Triple("housework", "Rengøring / husarbejde", "Home"),
    Triple("playing_kids", "Leg med børn", "MoodKid"),
).associate { (key, label, icon) -> key to (label to icon) }

/** (label, Tabler icon) for a sport type; unknown types keep their own name. */
internal fun sportMeta(sportType: String): Pair<String, String> = SPORTS[sportType] ?: (sportType to "Activity")

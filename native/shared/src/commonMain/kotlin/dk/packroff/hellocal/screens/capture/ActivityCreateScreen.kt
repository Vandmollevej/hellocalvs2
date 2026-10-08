package dk.packroff.hellocal.screens.capture

import dk.packroff.hellocal.ui.icons.HcIcon
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAccordionCard
import dk.packroff.hellocal.ui.HcChevronRow
import dk.packroff.hellocal.ui.HcChoiceChip
import dk.packroff.hellocal.ui.CaptureDatePickerSheet
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.CaptureFilledField
import dk.packroff.hellocal.ui.HcSearchField
import dk.packroff.hellocal.ui.CaptureTimePickerSheet
import dk.packroff.hellocal.ui.CaptureValueField
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.serialization.Serializable
import kotlin.math.roundToInt

@Serializable
internal data class ActivityOption(
    val key: String,
    val label: String,
    val custom: Boolean = false,
    val pending: Boolean = false,
    val words: List<String> = emptyList(),
)

@Serializable
private data class ActivityOptionsResponse(val options: List<ActivityOption> = emptyList())

@Serializable
private data class ActivityOptionResponse(val option: ActivityOption)

@Serializable
private data class ActivityEstimate(val met: Double = 0.0, val kcal: Int? = null, val method: String = "INTENSITY")

@Serializable
private data class ActivityEstimateResponse(val estimate: ActivityEstimate, val hasWeight: Boolean = true)

/** src/lib/pal-model.ts TRAINING_INTENSITIES */
private val TRAINING_INTENSITIES = listOf("LIGHT", "MODERATE", "VIGOROUS", "VERY_VIGOROUS")

/** src/lib/sport-icons.ts — Tabler icon per activity key (fallback Activity). */
private val SPORT_ICONS = mapOf(
    "running" to "Run", "trail_running" to "Run", "orienteering" to "Run", "obstacle_race" to "Run", "treadmill" to "Treadmill",
    "cycling" to "Bike", "spinning" to "Bike", "mountain_biking" to "Bike", "ebike" to "Bike", "walking" to "Walk",
    "nordic_walking" to "Trekking", "hiking" to "Mountain", "dog_walking" to "Dog", "stair_climbing" to "StairsUp", "climbing" to "Mountain",
    "swimming" to "Swimming", "open_water" to "Swimming", "water_polo" to "Swimming", "aqua_fitness" to "Pool", "rowing" to "Kayak",
    "rowing_machine" to "Kayak", "kayaking" to "Kayak", "canoeing" to "Kayak", "sup" to "Kayak", "surfing" to "WaveSine",
    "windsurfing" to "Sailboat", "cardio" to "Heartbeat", "hiit" to "Heartbeat", "circuit" to "Heartbeat", "elliptical" to "Heartbeat",
    "aerobics" to "Heartbeat", "strength" to "Barbell", "crossfit" to "Barbell", "bootcamp" to "Barbell", "kettlebell" to "Barbell",
    "bodyweight" to "Gymnastics", "jump_rope" to "JumpRope", "trampoline" to "Gymnastics", "yoga" to "Yoga", "pilates" to "Stretching",
    "dance" to "Music", "zumba" to "Music", "ballet" to "Music", "boxing" to "Karate", "kickboxing" to "Karate", "martial_arts" to "Karate",
    "wrestling" to "Karate", "fencing" to "Swords", "football" to "BallFootball", "handball" to "PlayHandball", "basketball" to "BallBasketball",
    "volleyball" to "BallVolleyball", "floorball" to "Activity", "ice_hockey" to "IceSkating", "rugby" to "Activity", "ultimate" to "Disc",
    "tennis" to "BallTennis", "padel" to "BallTennis", "badminton" to "BallTennis", "squash" to "BallTennis", "table_tennis" to "PingPong",
    "golf" to "Golf", "ski" to "Snowflake", "cross_country_ski" to "Snowflake", "snowboard" to "Snowboarding", "ice_skating" to "IceSkating",
    "snow_shoveling" to "Shovel", "inline_skating" to "Skateboarding", "skateboarding" to "Skateboarding", "horse_riding" to "Horse",
    "gardening" to "Plant", "woodcutting" to "Axe", "moving" to "Box", "housework" to "Home", "playing_kids" to "MoodKid", "other" to "Activity",
)

internal fun sportIcon(key: String): String = SPORT_ICONS[key] ?: "Activity"

/** src/components/activity/ActivityPicker.tsx — search + "Add … as activity". */
@Composable
internal fun ActivityPicker(onPick: (ActivityOption) -> Unit, busy: Boolean = false) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var options by remember { mutableStateOf<List<ActivityOption>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    var adding by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        options = try {
            ApiJson.decodeFromJsonElement(ActivityOptionsResponse.serializer(), Api.get("/api/activity-types")).options
        } catch (e: Exception) {
            emptyList()
        }
    }

    val trimmed = query.trim()
    val needle = trimmed.lowercase()
    val matches = if (needle.isEmpty()) options else {
        // Name first, then synonyms.
        val byLabel = options.filter { it.label.lowercase().contains(needle) }
        val byWord = options.filter { o -> o !in byLabel && o.words.any { it.lowercase().contains(needle) } }
        byLabel + byWord
    }
    val exact = options.any { it.label.lowercase() == needle }

    fun addManual() {
        adding = true
        scope.launch {
            try {
                val option = ApiJson.decodeFromJsonElement(ActivityOptionResponse.serializer(), Api.post("/api/activity-types", mapOf("name" to trimmed))).option
                onPick(option)
            } catch (e: Exception) {
            } finally {
                adding = false
            }
        }
    }

    val disabled = busy || adding
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        HcSearchField(query, { query = it }, t.t("activity.searchPlaceholder"))
        val showAdd = trimmed.length >= 2 && !exact
        if (matches.isNotEmpty() || showAdd) {
            HcAccordionCard {
                matches.forEachIndexed { index, option ->
                    HcChevronRow(
                        label = if (option.pending) "${option.label} (${t.t("activity.pending")})" else option.label,
                        onClick = if (disabled) null else ({ onPick(option) }),
                        icon = sportIcon(option.key),
                        divider = index < matches.lastIndex || showAdd,
                    )
                }
                if (showAdd) {
                    HcChevronRow(
                        label = t.t("activity.addManual", "name" to trimmed),
                        onClick = if (disabled) null else ({ addManual() }),
                        icon = "Plus",
                        divider = false,
                    )
                }
            }
        }
    }
}

private fun pad2(n: Int) = n.toString().padStart(2, '0')

/** Default start: date/time from the calendar, else now. */
private fun defaultStart(date: String?, time: String?): LocalDateTime {
    val now = CaptureDates.nowLocal()
    val day = CaptureDates.parseDate(date) ?: now.date
    val clock = time?.let { Regex("^(\\d{1,2}):(\\d{2})").find(it) }
    val hour = clock?.groupValues?.get(1)?.toIntOrNull()?.coerceIn(0, 23) ?: now.hour
    val minute = clock?.groupValues?.get(2)?.toIntOrNull()?.coerceIn(0, 59) ?: now.minute
    return LocalDateTime(day.year, day.monthNumber, day.dayOfMonth, hour, minute)
}

/** src/lib/activity-duration.ts durationMinutes */
private fun durationMinutes(hours: String, minutes: String): Int {
    val h = if (hours.isBlank()) 0.0 else hours.trim().toDoubleOrNull() ?: return 0
    val m = if (minutes.isBlank()) 0.0 else minutes.trim().toDoubleOrNull() ?: return 0
    if (h < 0 || m < 0) return 0
    return (h * 60 + m).roundToInt()
}

/** Native port of src/app/activity/create/page.tsx. */
@Composable
fun ActivityCreateScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var option by remember { mutableStateOf<ActivityOption?>(null) }
    var startedAt by remember { mutableStateOf(defaultStart(args.opt("date"), args.opt("time"))) }
    var hours by remember { mutableStateOf("0") }
    var mins by remember { mutableStateOf("30") }
    val totalMinutes = durationMinutes(hours, mins)
    var kcal by remember { mutableStateOf("") }
    var intensity by remember { mutableStateOf("MODERATE") }
    var distanceKm by remember { mutableStateOf("") }
    var estimate by remember { mutableStateOf<ActivityEstimate?>(null) }
    var hasWeight by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var pickDate by remember { mutableStateOf(false) }
    var pickStartTime by remember { mutableStateOf(false) }
    var pickEndTime by remember { mutableStateOf(false) }

    val current = option
    val showsDistance = current?.key == "walking" || current?.key == "running"

    // Estimated kcal from MET (docs/ACTIVITY-PAL.md F3). The user's own number wins.
    LaunchedEffect(current, totalMinutes, intensity, distanceKm, showsDistance) {
        if (current == null || totalMinutes <= 0) return@LaunchedEffect
        val query = buildList {
            add("sportType=${Location.encode(current.key)}")
            add("minutes=$totalMinutes")
            add("intensity=$intensity")
            val km = distanceKm.replace(",", ".").toDoubleOrNull()
            if (showsDistance && km != null && km > 0) add("distanceKm=${Location.encode(distanceKm)}")
        }.joinToString("&")
        runCatching { ApiJson.decodeFromJsonElement(ActivityEstimateResponse.serializer(), Api.get("/api/activities/estimate?$query")) }
            .getOrNull()?.let {
                estimate = it.estimate
                hasWeight = it.hasWeight
            }
    }

    val endMinutes = ((startedAt.hour * 60 + startedAt.minute + totalMinutes) % (24 * 60) + 24 * 60) % (24 * 60)

    fun setEnd(hour: Int, minute: Int) {
        val start = startedAt.hour * 60 + startedAt.minute
        val stop = hour * 60 + minute
        val diff = stop - start
        val next = if (diff > 0) diff else diff + 24 * 60
        hours = (next / 60).toString()
        mins = (next % 60).toString()
    }

    fun save() {
        val opt = option ?: return
        val ownKcal = if (kcal.isBlank()) null else kcal.trim().toDoubleOrNull() ?: -1.0
        if (totalMinutes <= 0 || (ownKcal != null && ownKcal <= 0) || (ownKcal == null && (estimate?.kcal ?: 0) <= 0)) {
            error = t.t("activity.invalid")
            return
        }
        saving = true
        error = null
        scope.launch {
            try {
                val km = distanceKm.replace(",", ".").toDoubleOrNull()
                val body = buildMap<String, Any?> {
                    put("sportType", opt.key)
                    put("startedAt", CaptureDates.toInstant(startedAt).toString())
                    put("durationMinutes", totalMinutes)
                    if (ownKcal != null) put("caloriesBurned", ownKcal)
                    put("intensity", intensity)
                    put("distanceKm", if (showsDistance && km != null && km > 0) km else null)
                }
                Api.post("/api/activities", body)
                NativeHooks.onRegistrationChanged()
                nav.push(if (args.opt("date") != null) "/calendar" else "/")
            } catch (e: Exception) {
                error = t.t("activity.saveError")
            } finally {
                saving = false
            }
        }
    }

    HcScreen(title = t.t("activity.title"), icon = { HcIcon("Activity", size = 20.dp, stroke = 2f, color = HcColors.White) }, contentPadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)) {
        if (current == null) {
            ActivityPicker(onPick = { option = it })
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcText(
                    "${current.label} · ${t.t("activity.change")}",
                    HcTypeRoles.Body,
                    Modifier.clickable { option = null },
                    bold = true,
                    underline = true,
                    color = HcColors.Black,
                )
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    HcText(t.t("activity.startedAt"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CaptureValueField(CaptureDates.dayMonthShort(startedAt.date, withYear = true, locale = t.locale), onClick = { pickDate = true }, modifier = Modifier.weight(1f))
                        CaptureValueField(CaptureDates.clock(startedAt), onClick = { pickStartTime = true }, modifier = Modifier.weight(1f))
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    HcText(t.t("activity.duration"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            CaptureFilledField(hours, { hours = it.filter(Char::isDigit) }, keyboardType = KeyboardType.Number)
                            HcText(t.t("activity.hours"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            CaptureFilledField(mins, { mins = it.filter(Char::isDigit) }, keyboardType = KeyboardType.Number)
                            HcText(t.t("activity.minutesShort"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        }
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            CaptureValueField("${pad2(endMinutes / 60)}:${pad2(endMinutes % 60)}", onClick = { pickEndTime = true })
                            HcText(t.t("activity.endedAt"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        }
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcText(t.t("activity.intensity"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    HcText(t.t("activity.intensityHint"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    TRAINING_INTENSITIES.forEach { key ->
                        HcChoiceChip(
                            t.t("onboarding.activity.intensity.$key"),
                            selected = intensity == key,
                            onClick = { intensity = key },
                            fill = true,
                            align = TextAlign.Start,
                            height = HcDimens.ControlHeight,
                        )
                    }
                }
                if (showsDistance) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        HcText(t.t("activity.distanceKm"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        CaptureFilledField(distanceKm, { distanceKm = it }, keyboardType = KeyboardType.Decimal)
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    HcText(t.t("activity.kcal"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    val est = estimate
                    val estKcal: Int = est?.kcal ?: 0
                    CaptureFilledField(
                        kcal,
                        { kcal = it.filter(Char::isDigit) },
                        placeholder = if (estKcal > 0) t.t("activity.kcalEstimated", "kcal" to estKcal) else "",
                        keyboardType = KeyboardType.Number,
                    )
                    val hint = when {
                        !hasWeight -> t.t("activity.kcalNoWeight")
                        est != null -> t.t(if (est.method == "SPEED") "activity.kcalHintSpeed" else "activity.kcalHintMet", "met" to formatMet(est.met))
                        else -> ""
                    }
                    if (hint.isNotEmpty()) HcText(hint, HcTypeRoles.Small, color = HcColors.TextSecondary)
                }
                HcError(error)
                HcButton(t.t("activity.save"), onClick = ::save, enabled = !saving)
            }
        }
    }

    if (pickDate) {
        CaptureDatePickerSheet(
            initial = startedAt.date,
            onPick = { d: LocalDate -> startedAt = LocalDateTime(d.year, d.monthNumber, d.dayOfMonth, startedAt.hour, startedAt.minute) },
            onDismiss = { pickDate = false },
            title = t.t("activity.startedAt"),
        )
    }
    if (pickStartTime) {
        CaptureTimePickerSheet(
            hour = startedAt.hour,
            minute = startedAt.minute,
            onPick = { h, m -> startedAt = LocalDateTime(startedAt.year, startedAt.monthNumber, startedAt.dayOfMonth, h, m) },
            onDismiss = { pickStartTime = false },
            title = t.t("activity.startedAt"),
        )
    }
    if (pickEndTime) {
        CaptureTimePickerSheet(
            hour = endMinutes / 60,
            minute = endMinutes % 60,
            onPick = { h, m -> setEnd(h, m) },
            onDismiss = { pickEndTime = false },
            title = t.t("activity.endedAt"),
        )
    }
}

/** MET as the web prints a JS number (3.5 → "3.5", 4 → "4"). */
private fun formatMet(met: Double): String = if (met == kotlin.math.floor(met)) met.toLong().toString() else met.toString()

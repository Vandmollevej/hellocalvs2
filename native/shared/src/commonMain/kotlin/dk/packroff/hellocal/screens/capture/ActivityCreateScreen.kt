package dk.packroff.hellocal.screens.capture

import dk.packroff.hellocal.ui.icons.HcIcon
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import dk.packroff.hellocal.theme.style
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Alignment
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import dk.packroff.hellocal.ui.FieldSlider
import dk.packroff.hellocal.ui.HcAccordionCard
import dk.packroff.hellocal.ui.FoodSwipeableRow
import dk.packroff.hellocal.ui.FoodSwipeTexts
import dk.packroff.hellocal.ui.HcChevronRow
import dk.packroff.hellocal.ui.HcChoiceChip
import dk.packroff.hellocal.ui.CaptureDatePickerSheet
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.CaptureFilledField
import dk.packroff.hellocal.ui.HcSearchField
import dk.packroff.hellocal.ui.CaptureValueField
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.CaptureTimePickerSheet
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileSleepRangeSlider
import dk.packroff.hellocal.screens.food.GlyphButton
import dk.packroff.hellocal.screens.calendar.SleepDefaults
import dk.packroff.hellocal.screens.calendar.SleepScheduleEntry
import dk.packroff.hellocal.screens.calendar.WorkShiftEntry
import dk.packroff.hellocal.screens.calendar.activityTrackStart
import dk.packroff.hellocal.screens.calendar.getSleepWindow
import dk.packroff.hellocal.screens.calendar.parseProfile
import dk.packroff.hellocal.screens.calendar.parseSchedules
import dk.packroff.hellocal.screens.calendar.parseShifts
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
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
    val favorite: Boolean = false,
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
    "squat" to "Barbell", "deadlift" to "Barbell", "bench_press" to "Barbell", "shoulder_press" to "Barbell", "lunges" to "Barbell",
    "leg_training" to "Barbell", "upper_body" to "Barbell", "free_weights" to "Barbell", "machine_training" to "Barbell", "weightlifting" to "Barbell",
    "powerlifting" to "Barbell", "bodybuilding" to "Barbell", "strongman" to "Barbell", "body_pump" to "Barbell", "pull_ups" to "Gymnastics",
    "push_ups" to "Gymnastics", "core" to "Gymnastics", "trx" to "Gymnastics", "resistance_bands" to "Stretching", "battle_ropes" to "Heartbeat",
    "air_bike" to "Bike", "ski_erg" to "Heartbeat", "gymnastics" to "Gymnastics", "parkour" to "Run", "barre" to "Music",
    "tai_chi" to "Yoga", "stretching" to "Stretching", "rehab" to "Stretching",
)

internal fun sportIcon(key: String): String = SPORT_ICONS[key] ?: "Activity"

/**
 * src/components/activity/ActivityPicker.tsx — search + "Add … as activity".
 * onAdd: every row gets a ⊕ on the far right that adds the activity to the
 * workout ("Added") instead of opening it alone.
 */
@Composable
internal fun ActivityPicker(onPick: (ActivityOption) -> Unit, busy: Boolean = false, onAdd: ((ActivityOption) -> Unit)? = null) {
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

    fun toggleFavorite(option: ActivityOption) {
        val next = !option.favorite
        fun apply(value: Boolean) {
            val updated = options.map { if (it.key == option.key) it.copy(favorite = value) else it }
            options = updated.filter { it.favorite } + updated.filter { !it.favorite }
        }
        apply(next)
        scope.launch {
            try {
                Api.put("/api/activity-types", mapOf("key" to option.key, "favorite" to next))
            } catch (e: Exception) {
                apply(!next)
            }
        }
    }

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
        // Favourites in their own block on top, like "My favourites" under recipes
        // (user 2026-10-17). While searching: one combined list.
        val favoriteOptions = if (trimmed.isEmpty()) matches.filter { it.favorite } else emptyList()
        val restOptions = if (trimmed.isEmpty()) matches.filter { !it.favorite } else matches

        @Composable
        fun OptionCard(list: List<ActivityOption>, withAdd: Boolean) {
            HcAccordionCard {
                // Favourite by swiping right, like food (user 2026-10-17); ⊕ adds the sport to "Added".
                list.forEachIndexed { index, option ->
                    FoodSwipeableRow(
                        texts = FoodSwipeTexts(
                            favorite = t.t("swipeableRow.favorite"),
                            copy = "",
                            reportError = "",
                            delete = "",
                            favoriteSaved = t.t("swipeableRow.favoriteSaved"),
                        ),
                        onDelete = null,
                        onFavorite = { toggleFavorite(option) },
                        isFavorite = option.favorite,
                    ) {
                        HcChevronRow(
                            label = if (option.pending) "${option.label} (${t.t("activity.pending")})" else option.label,
                            onClick = if (disabled) null else ({ onPick(option) }),
                            icon = sportIcon(option.key),
                            divider = index < list.lastIndex || withAdd,
                            trailing = if (onAdd == null) null else ({
                                Box(
                                    Modifier.heightIn(min = HcDimens.ControlHeight).clickable(enabled = !disabled) { onAdd(option) }.padding(start = 4.dp, end = 16.dp),
                                    contentAlignment = Alignment.Center,
                                ) { HcIcon("CirclePlus", size = 24.dp, color = HcColors.Green) }
                            }),
                        )
                    }
                }
                if (withAdd) {
                    HcChevronRow(
                        label = t.t("activity.addManual", "name" to trimmed),
                        onClick = if (disabled) null else ({ addManual() }),
                        icon = "Plus",
                        divider = false,
                    )
                }
            }
        }

        if (favoriteOptions.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HcSectionTitle(t.t("activity.favoritesTitle"))
                OptionCard(favoriteOptions, withAdd = false)
            }
        }
        if (restOptions.isNotEmpty() || showAdd) {
            if (favoriteOptions.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcSectionTitle(t.t("activity.allTitle"))
                    OptionCard(restOptions, withAdd = showAdd)
                }
            } else {
                OptionCard(restOptions, withAdd = showAdd)
            }
        }
    }
}

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
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var pickDate by remember { mutableStateOf(false) }
    // Træningspas: chosen category, exercises with sets and the open exercise popup.
    var trainingCategory by remember { mutableStateOf<String?>(null) }
    var entries by remember { mutableStateOf<List<TrainingEntry>>(emptyList()) }
    var sheetCategory by remember { mutableStateOf<String?>(null) }
    val trainingCatalog = rememberTrainingCatalog()

    fun addExercise(category: String, key: String) {
        if (option == null || trainingCategory != category) {
            option = ActivityOption(key = TRAINING_SPORT[category] ?: "strength", label = t.t("activity.training.category.$category"))
            trainingCategory = category
            entries = listOf(newTrainingEntry(key, category))
        } else {
            entries = entries + newTrainingEntry(key, category)
        }
    }

    fun changeActivity() {
        option = null
        trainingCategory = null
        entries = emptyList()
    }
    // Workout ("Added", user 2026-10-17): empty = none. Exercises follow each other from startedAt.
    var session by remember { mutableStateOf<List<SessionEntry>>(emptyList()) }
    var nextEntryId by remember { mutableIntStateOf(1) }
    var sessionKcal by remember { mutableStateOf<Int?>(null) }
    var pickTime by remember { mutableStateOf(false) }
    var sleepDefaults by remember { mutableStateOf<SleepDefaults?>(null) }
    var weekdaySchedules by remember { mutableStateOf<Map<Int, SleepScheduleEntry>>(emptyMap()) }
    var workShifts by remember { mutableStateOf<Map<LocalDate, WorkShiftEntry>>(emptyMap()) }
    var sleepLoaded by remember { mutableStateOf(false) }

    // Sleep from the calendar (wake-up after the night before), so the track only shows waking hours.
    LaunchedEffect(Unit) {
        runCatching {
            coroutineScope {
                val profile = async { Api.get("/api/profile") }
                val schedule = async { Api.get("/api/sleep-schedule") }
                val shifts = async { Api.get("/api/work-shifts") }
                sleepDefaults = parseProfile(profile.await(), startedAt.date).first
                weekdaySchedules = parseSchedules(schedule.await())
                workShifts = parseShifts(shifts.await())
                sleepLoaded = true
            }
        }
    }

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
            }
    }

    // Total estimated kcal for the workout (same MET estimate the server saves).
    LaunchedEffect(session, intensity) {
        val entries = session
        if (entries.isEmpty()) return@LaunchedEffect
        val values = entries.map { entry ->
            runCatching {
                ApiJson.decodeFromJsonElement(
                    ActivityEstimateResponse.serializer(),
                    Api.get("/api/activities/estimate?sportType=${Location.encode(entry.option.key)}&minutes=${entry.minutes}&intensity=$intensity"),
                ).estimate.kcal
            }.getOrNull()
        }
        sessionKcal = if (values.all { it != null }) values.sumOf { it ?: 0 } else null
    }

    fun addToSession(picked: ActivityOption) {
        session = session + SessionEntry(nextEntryId, picked, SESSION_DEFAULT_MINUTES)
        nextEntryId += 1
    }

    fun saveSession() {
        val entries = session
        if (entries.isEmpty()) {
            error = t.t("activity.session.invalid")
            return
        }
        saving = true
        error = null
        scope.launch {
            try {
                Api.post(
                    "/api/activities",
                    mapOf(
                        "session" to mapOf(
                            "startedAt" to CaptureDates.toInstant(startedAt).toString(),
                            "intensity" to intensity,
                            "items" to entries.map { mapOf("sportType" to it.option.key, "durationMinutes" to it.minutes) },
                        ),
                    ),
                )
                NativeHooks.onRegistrationChanged()
                nav.push(if (args.opt("date") != null) "/calendar" else "/")
            } catch (e: Exception) {
                error = t.t("activity.session.saveError")
            } finally {
                saving = false
            }
        }
    }

    val startMinutes = startedAt.hour * 60 + startedAt.minute
    val lastMinute = 24 * 60 - 1
    // The track shows only the chosen day (00:00-23:59): the end never passes midnight.
    val endMinutes = minOf(startMinutes + totalMinutes, lastMinute)
    val sleepWindow = if (sleepLoaded) getSleepWindow(startedAt.date, sleepDefaults, weekdaySchedules, workShifts) else null
    val trackStart = activityTrackStart(sleepWindow, startMinutes)

    fun applyDuration(total: Int) {
        hours = (total / 60).toString()
        mins = (total % 60).toString()
    }

    // End handle changes the duration; start handle moves the start so the end stays put.
    fun setEnd(value: Int) = applyDuration(value.coerceIn(startMinutes + 1, lastMinute) - startMinutes)

    fun setStart(value: Int) {
        val nextStart = minOf(lastMinute - 1, value)
        val end = minOf(lastMinute, maxOf(endMinutes, nextStart + 5))
        startedAt = LocalDateTime(startedAt.year, startedAt.monthNumber, startedAt.dayOfMonth, nextStart / 60, nextStart % 60)
        applyDuration(end - nextStart)
    }

    /** src/lib/activity-duration.ts stepDuration — whole five-minute steps, kept within the day. */
    fun step(direction: Int) {
        val next = if (direction > 0) (totalMinutes / 5) * 5 + 5 else (totalMinutes + 4) / 5 * 5 - 5
        applyDuration(minOf(next.coerceIn(5, 24 * 60), lastMinute - startMinutes))
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
                    if (trainingCategory != null && entries.isNotEmpty()) put("exercises", entries.map { it.toBody() })
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

    @Composable
    fun IntensityPicker() {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            HcText(t.t("activity.intensity"), HcTypeRoles.Small, color = HcColors.TextSecondary)
            HcText(t.t("activity.intensityHint"), HcTypeRoles.Small, color = HcColors.TextSecondary)
            val level = TRAINING_INTENSITIES.indexOf(intensity)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                TRAINING_INTENSITIES.forEachIndexed { index, key ->
                    Box(
                        Modifier
                            .weight(1f)
                            .height((24 + index * 16).dp)
                            .background(if (index <= level) HcColors.Accent else HcColors.Card, RoundedCornerShape(HcDimens.RadiusCard))
                            .clickable { intensity = key },
                    )
                }
            }
            HcText(t.t("onboarding.activity.intensity.$intensity"), HcTypeRoles.Body, bold = true, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        }
    }

    val activeSession = session
    // Save sits fixed at the bottom above the menu (user 2026-10-17).
    val footerContent: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            HcError(error)
            if (current != null) {
                HcButton(t.t("activity.save"), onClick = ::save, enabled = !saving)
            } else {
                HcButton(t.t("activity.session.save"), onClick = ::saveSession, enabled = !saving)
            }
        }
    }

    HcScreen(title = t.t("activity.title"), icon = { HcIcon("Activity", size = 20.dp, stroke = 2f, color = HcColors.White) }, bottom = if (current != null || activeSession.isNotEmpty()) footerContent else null, contentPadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)) {
        if (current == null) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                TrainingCategoryRows(onPick = { sheetCategory = it })
                // ⊕ on a sport puts it here; several parts are saved together as one workout.
                if (activeSession.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        HcSectionTitle(t.t("activity.session.added"))
                        TrainingSessionCard(activeSession) { session = it }
                        val total = activeSession.sumOf { it.minutes }
                        val kcalTotal = sessionKcal
                        HcText(
                            if (kcalTotal != null) t.t("activity.session.totalKcal", "minutes" to total.toString(), "kcal" to kcalTotal.toString())
                            else t.t("activity.session.total", "minutes" to total.toString()),
                            HcTypeRoles.Small,
                            color = HcColors.TextSecondary,
                            align = TextAlign.End,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        HcText(t.t("activity.startedAt"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(Modifier.weight(1f)) {
                                CaptureValueField(CaptureDates.dayMonthShort(startedAt.date, withYear = true, locale = t.locale), onClick = { pickDate = true })
                            }
                            Box(Modifier.weight(1f)) {
                                CaptureValueField(CaptureDates.clock(startedAt), onClick = { pickTime = true })
                            }
                        }
                    }
                    IntensityPicker()
                }
                ActivityPicker(onPick = { option = it }, onAdd = ::addToSession)
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcText(
                    current.label,
                    HcTypeRoles.Body,
                    Modifier.clickable { changeActivity() },
                    bold = true,
                    underline = true,
                    color = HcColors.Black,
                )
                val category = trainingCategory
                if (category != null) {
                    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        HcSectionTitle(t.t("activity.training.exercises"))
                        entries.forEachIndexed { index, entry ->
                            TrainingExerciseCard(
                                entry = entry,
                                category = category,
                                catalog = trainingCatalog,
                                onChange = { next -> entries = entries.mapIndexed { i, e -> if (i == index) next else e } },
                                onRemove = { entries = entries.filterIndexed { i, _ -> i != index } },
                            )
                        }
                        HcButton(t.t("activity.training.addExercise"), onClick = { sheetCategory = category }, kind = HcButtonKind.Secondary)
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcText(t.t("activity.startedAt"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    CaptureValueField(CaptureDates.dayMonthShort(startedAt.date, withYear = true, locale = t.locale), onClick = { pickDate = true })
                    ProfileSleepRangeSlider(
                        wakeMinutes = endMinutes,
                        bedtimeMinutes = startMinutes,
                        onChangeWake = ::setEnd,
                        onChangeBedtime = ::setStart,
                        bedtimeFirst = true,
                        trackStart = trackStart,
                        trackEnd = lastMinute,
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    HcText(t.t("activity.duration"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                        Row(Modifier.widthIn(max = 320.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            GlyphButton("−", { step(-1) })
                            Row(
                                Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(HcColors.Tan).padding(vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center,
                            ) {
                                BasicTextField(
                                    value = hours,
                                    onValueChange = { hours = it.filter(Char::isDigit) },
                                    singleLine = true,
                                    textStyle = HcTypeRoles.PageTitle.style(HcColors.Black).copy(textAlign = TextAlign.End),
                                    cursorBrush = SolidColor(HcColors.Action),
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.width(((hours.length.coerceAtLeast(1) + 0.5f) * 13).dp),
                                )
                                HcText(" ${t.t("activity.hours")} ", HcTypeRoles.PageTitle, color = HcColors.Black)
                                BasicTextField(
                                    value = mins,
                                    onValueChange = { mins = it.filter(Char::isDigit) },
                                    singleLine = true,
                                    textStyle = HcTypeRoles.PageTitle.style(HcColors.Black).copy(textAlign = TextAlign.End),
                                    cursorBrush = SolidColor(HcColors.Action),
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.width(((mins.length.coerceAtLeast(1) + 0.5f) * 13).dp),
                                )
                                HcText(" ${t.t("activity.minutesShort")}", HcTypeRoles.PageTitle, color = HcColors.Black)
                            }
                            GlyphButton("+", { step(1) })
                        }
                    }
                }
                IntensityPicker()
                if (showsDistance) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        HcText(t.t("activity.distanceKm"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        CaptureFilledField(distanceKm, { distanceKm = it }, keyboardType = KeyboardType.Decimal)
                        FieldSlider(distanceKm, 0.0, 100.0, { distanceKm = it }, step = 0.1)
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    HcText(t.t("activity.kcal"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    val estKcal: Int = estimate?.kcal ?: 0
                    CaptureFilledField(
                        if (kcal.isNotEmpty()) kcal else if (estKcal > 0) estKcal.toString() else "",
                        { kcal = it.filter(Char::isDigit) },
                        keyboardType = KeyboardType.Number,
                    )
                    FieldSlider(if (kcal.isNotEmpty()) kcal else if (estKcal > 0) estKcal.toString() else "", 0.0, 3000.0, { kcal = it }, step = 10.0)
                }
            }
        }
    }

    sheetCategory?.let { category ->
        TrainingExerciseSheet(
            category = category,
            catalog = trainingCatalog,
            onPick = { key -> addExercise(category, key) },
            onDismiss = { sheetCategory = null },
        )
    }

    if (pickDate) {
        CaptureDatePickerSheet(
            initial = startedAt.date,
            onPick = { d: LocalDate -> startedAt = LocalDateTime(d.year, d.monthNumber, d.dayOfMonth, startedAt.hour, startedAt.minute) },
            onDismiss = { pickDate = false },
            title = t.t("activity.startedAt"),
        )
    }
    if (pickTime) {
        CaptureTimePickerSheet(
            hour = startedAt.hour,
            minute = startedAt.minute,
            onPick = { h, m -> startedAt = LocalDateTime(startedAt.year, startedAt.monthNumber, startedAt.dayOfMonth, h, m) },
            onDismiss = { pickTime = false },
            title = t.t("activity.session.startTime"),
        )
    }
}

private const val SESSION_DEFAULT_MINUTES = 15 // src/lib/training-session.ts

internal data class SessionEntry(val id: Int, val option: ActivityOption, val minutes: Int)

/** src/components/activity/TrainingSessionCard.tsx — the workout's exercises, ±5 min each, removable. */
@Composable
private fun TrainingSessionCard(entries: List<SessionEntry>, onChange: (List<SessionEntry>) -> Unit) {
    val t = LocalTranslator.current
    HcAccordionCard {
        entries.forEachIndexed { index, entry ->
            fun update(minutes: Int) = onChange(entries.map { if (it.id == entry.id) it.copy(minutes = minutes) else it })
            /** src/lib/activity-duration.ts stepDuration */
            fun step(direction: Int): Int {
                val next = if (direction > 0) (entry.minutes / 5) * 5 + 5 else (entry.minutes + 4) / 5 * 5 - 5
                return next.coerceIn(5, 24 * 60)
            }
            Column {
                Row(Modifier.fillMaxWidth().height(48.dp).padding(start = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    HcIcon(sportIcon(entry.option.key), size = 20.dp, color = HcColors.Black)
                    HcText(entry.option.label, HcTypeRoles.Body, Modifier.weight(1f).padding(start = 8.dp), color = HcColors.Black, maxLines = 1)
                    GlyphButton("−", { update(step(-1)) }, size = 36.dp)
                    HcText("${entry.minutes} ${t.t("activity.minutesShort")}", HcTypeRoles.Body, Modifier.width(56.dp), bold = true, align = TextAlign.Center, color = HcColors.Black)
                    GlyphButton("+", { update(step(1)) }, size = 36.dp)
                    Box(
                        Modifier.height(48.dp).clickable { onChange(entries.filter { it.id != entry.id }) }.padding(start = 4.dp, end = 16.dp),
                        contentAlignment = Alignment.Center,
                    ) { HcIcon("X", size = 20.dp, color = HcColors.Black) }
                }
                if (index < entries.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.TanDark))
            }
        }
    }
}

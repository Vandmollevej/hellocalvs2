package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.ProfileCenteredText
import dk.packroff.hellocal.ui.ProfileFieldLabel
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import dk.packroff.hellocal.ui.ProfileSleepRangeSlider
import dk.packroff.hellocal.ui.ProfileTanRow
import dk.packroff.hellocal.ui.ProfileTimeWheelSheet
import dk.packroff.hellocal.ui.ProfileValueButton
import dk.packroff.hellocal.ui.profileFormatClock
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

// "Skiftende arbejdstider" is hidden for now; the code is kept for later.
private const val SHOW_SHIFT_WORK = false

// Default sleep 22.00–07.00 (docs/DECISIONS.md 2026-10-06).
private const val DEFAULT_BEDTIME_MINUTES = 22 * 60
private const val DEFAULT_WAKE_MINUTES = 7 * 60

private data class SleepSchedule(val weekday: Int, val bedtime: String, val wakeTime: String)

private fun timeToMinutes(time: String?): Int? {
    if (time.isNullOrEmpty()) return null
    val parts = time.split(":")
    val hours = parts.getOrNull(0)?.toIntOrNull() ?: return null
    val mins = parts.getOrNull(1)?.toIntOrNull() ?: return null
    return hours * 60 + mins
}

/** Adds (possibly negative) minutes to "HH:MM", wrapping over midnight. */
private fun addMinutes(time: String, minutes: Int): String = profileFormatClock((timeToMinutes(time) ?: 0) + minutes)

/** Native port of src/app/profile/sleep/page.tsx. */
@Composable
fun SleepScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var user by remember { mutableStateOf<ProfileUser?>(null) }
    val schedules = remember { mutableStateMapOf<Int, SleepSchedule>() }
    var loading by remember { mutableStateOf(true) }
    var perDayOpen by remember { mutableStateOf(false) }
    val defaultsDebouncer = remember { ProfileDebouncer(scope) }
    val weekdayDebouncers = remember { mutableMapOf<Int, ProfileDebouncer>() }
    var picking by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            coroutineScope {
                val profile = async { ProfileApi.loadUser() }
                val scheduleData = async { Api.get("/api/sleep-schedule") as JsonObject }
                user = profile.await()
                val list = scheduleData.await()["schedules"] as? JsonArray ?: JsonArray(emptyList())
                list.forEach { item ->
                    val obj = item as? JsonObject ?: return@forEach
                    val weekday = obj["weekday"]?.jsonPrimitive?.intOrNull ?: return@forEach
                    schedules[weekday] = SleepSchedule(
                        weekday,
                        obj["bedtime"]?.jsonPrimitive?.contentOrNull ?: "",
                        obj["wakeTime"]?.jsonPrimitive?.contentOrNull ?: "",
                    )
                }
                if (schedules.isNotEmpty()) perDayOpen = true
            }
        } catch (e: Exception) {
            user = null
        }
        loading = false
    }

    // Takes a whole patch so two fields changed together (wake-up + the computed bedtime) are both saved.
    fun updateDefaults(bedtime: String?, wakeTime: String?) {
        val current = user ?: return
        user = current.copy(defaultBedtime = bedtime, defaultWakeTime = wakeTime)
        // Both fields every time, so a newer change inside the 500 ms window never drops an older one.
        defaultsDebouncer.run { ProfileApi.patch(mapOf("defaultBedtime" to bedtime, "defaultWakeTime" to wakeTime)) }
    }

    fun toggleShiftWork(enabled: Boolean) {
        user = user?.copy(shiftWorkEnabled = enabled)
        scope.launch { runCatching { ProfileApi.patch(mapOf("shiftWorkEnabled" to enabled)) } }
    }

    fun saveWeekday(weekday: Int, bedtime: String, wakeTime: String) {
        weekdayDebouncers.getOrPut(weekday) { ProfileDebouncer(scope) }.run {
            Api.put("/api/sleep-schedule", mapOf("weekday" to weekday, "bedtime" to bedtime.ifEmpty { null }, "wakeTime" to wakeTime.ifEmpty { null }))
        }
    }

    // When Monday is filled in, the value is copied to Tuesday–Friday, but only into fields that are still empty.
    fun updateWeekday(weekday: Int, field: String, value: String) {
        val existing = schedules[weekday] ?: SleepSchedule(weekday, "", "")
        val next = if (field == "bedtime") existing.copy(bedtime = value) else existing.copy(wakeTime = value)
        saveWeekday(weekday, next.bedtime, next.wakeTime)
        val before = schedules.toMap()
        schedules[weekday] = next
        if (weekday == 0 && value.isNotEmpty()) {
            for (other in listOf(1, 2, 3, 4)) {
                val otherExisting = before[other]
                val filled = if (field == "bedtime") otherExisting?.bedtime else otherExisting?.wakeTime
                if (!filled.isNullOrEmpty()) continue
                val base = otherExisting ?: SleepSchedule(other, "", "")
                val otherNext = if (field == "bedtime") base.copy(bedtime = value) else base.copy(wakeTime = value)
                schedules[other] = otherNext
                saveWeekday(other, otherNext.bedtime, otherNext.wakeTime)
            }
        }
    }

    HcScreen(title = t.t("profileSleep.title"), contentPadding = ProfilePagePadding) {
        val current = user
        when {
            loading -> HcLoader()
            current == null -> ProfileCenteredText(t.t("profileSleep.loadError"))
            else -> ProfilePage {
                HcText(t.t("profileSleep.intro"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProfileFieldLabel(t.t("profileSleep.defaultWakeTime"))
                        ProfileValueButton(current.defaultWakeTime ?: "", onClick = { picking = "wake" })
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProfileFieldLabel(t.t("profileSleep.defaultBedtime"))
                        ProfileValueButton(current.defaultBedtime ?: "", onClick = { picking = "bed" })
                    }
                }
                HcText(t.t("profileSleep.defaultTimesHint"), HcTypeRoles.Small, Modifier.offset(y = (-8).dp), color = HcColors.TextSecondary)

                ProfileTanRow(onClick = { perDayOpen = !perDayOpen }) {
                    HcText(t.t("profileSleep.perDayToggle"), HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.Black)
                    HcChevron(if (perDayOpen) ChevronDirection.Up else ChevronDirection.Down, compact = true, color = HcColors.Black)
                }

                if (perDayOpen) {
                    dk.packroff.hellocal.ui.HcCard {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            HcText(t.t("profileSleep.perDayHint"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                            (0..6).forEach { weekday ->
                                val schedule = schedules[weekday]
                                // Days not filled in show the general default as a starting point.
                                val wakeMinutes = timeToMinutes(schedule?.wakeTime) ?: timeToMinutes(current.defaultWakeTime) ?: DEFAULT_WAKE_MINUTES
                                val bedtimeMinutes = timeToMinutes(schedule?.bedtime) ?: timeToMinutes(current.defaultBedtime) ?: DEFAULT_BEDTIME_MINUTES
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    HcText(t.t("profileSleep.weekdays.$weekday"), HcTypeRoles.Small, bold = true, color = HcColors.Black)
                                    ProfileSleepRangeSlider(
                                        wakeMinutes = wakeMinutes,
                                        bedtimeMinutes = bedtimeMinutes,
                                        onChangeWake = { updateWeekday(weekday, "wakeTime", profileFormatClock(it)) },
                                        onChangeBedtime = { updateWeekday(weekday, "bedtime", profileFormatClock(it)) },
                                    )
                                }
                            }
                        }
                    }
                }

                if (SHOW_SHIFT_WORK) {
                    HcToggle(
                        checked = current.shiftWorkEnabled,
                        onChange = ::toggleShiftWork,
                        label = t.t("profileSleep.shiftWork"),
                        description = t.t("profileSleep.shiftWorkDescription"),
                    )
                    if (current.shiftWorkEnabled) HcText(t.t("profileSleep.shiftWorkHint"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                }
            }
        }
    }

    val current = user
    when (picking) {
        "wake" -> if (current != null) {
            ProfileTimeWheelSheet(
                t.t("profileSleep.defaultWakeTime"),
                timeToMinutes(current.defaultWakeTime) ?: DEFAULT_WAKE_MINUTES,
                onDismiss = { picking = null },
                onDone = { minutes ->
                    val wakeTime = profileFormatClock(minutes)
                    // 7.5 hours of sleep are filled in when no bedtime is set yet.
                    val bedtime = if (current.defaultBedtime.isNullOrEmpty()) addMinutes(wakeTime, -450) else current.defaultBedtime
                    updateDefaults(bedtime, wakeTime)
                },
            )
        }
        "bed" -> if (current != null) {
            ProfileTimeWheelSheet(
                t.t("profileSleep.defaultBedtime"),
                timeToMinutes(current.defaultBedtime) ?: DEFAULT_BEDTIME_MINUTES,
                onDismiss = { picking = null },
                onDone = { minutes ->
                    val bedtime = profileFormatClock(minutes)
                    val wakeTime = if (current.defaultWakeTime.isNullOrEmpty()) addMinutes(bedtime, 450) else current.defaultWakeTime
                    updateDefaults(bedtime, wakeTime)
                },
            )
        }
    }
}

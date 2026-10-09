package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.screens.capture.ActivityPicker
import dk.packroff.hellocal.screens.capture.sportIcon
import dk.packroff.hellocal.screens.statistics.TextAnchor
import dk.packroff.hellocal.screens.statistics.ViewBoxCanvas
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.FoodSheetSkipButton
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalHcSheetClose
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.daysUntil
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.minus
import kotlinx.datetime.plus
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

// src/components/activity/HeartRateSpikePrompt.tsx (+ HeartRateSpikeChart,
// PulseWeekStrip, PulseSuggestionCard, src/lib/pulse-week.ts). The first
// screen after opening when a connected integration showed a noticeable
// pulse spike without registered sport: "Vi kan se, at din puls var højere end
// sædvanlig i går", the four-hour graph, the week strip, the robot's guess and
// "Hvad foretog du dig?". Up to three spikes are asked per visit.

private const val MAX_PROMPTS_PER_VISIT = 3
private const val PULSE_LATER_KEY = "hf-pulse-prompt-later"

/**
 * window.sessionStorage for the front-page prompts' "later" flags (same key
 * names as the web). Session storage lives as long as the browser tab, so the
 * native equivalent lives as long as the app process — never persisted, or
 * "Senere" would silence the prompt forever.
 */
internal object HomeSessionFlags {
    private val flags = mutableSetOf<String>()
    fun has(key: String): Boolean = key in flags
    fun set(key: String) {
        flags += key
    }
}

/** Intl.DateTimeFormat outputs the front-page prompts need, per app locale. */
internal object HomeIntl {
    private val weekdaysLong = mapOf(
        Locale.Da to listOf("mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"),
        Locale.No to listOf("mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"),
        Locale.Sv to listOf("måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"),
        Locale.De to listOf("Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"),
        Locale.Nl to listOf("maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"),
        Locale.Fr to listOf("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"),
        Locale.En to listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"),
    )

    /** { weekday: "short" } with a trailing "." removed (PulseWeekStrip). */
    private val weekdaysShort = mapOf(
        Locale.Da to listOf("man", "tirs", "ons", "tors", "fre", "lør", "søn"),
        Locale.No to listOf("man", "tir", "ons", "tor", "fre", "lør", "søn"),
        Locale.Sv to listOf("mån", "tis", "ons", "tors", "fre", "lör", "sön"),
        Locale.De to listOf("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"),
        Locale.Nl to listOf("ma", "di", "wo", "do", "vr", "za", "zo"),
        Locale.Fr to listOf("lun", "mar", "mer", "jeu", "ven", "sam", "dim"),
        Locale.En to listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"),
    )

    private fun index(date: LocalDate) = date.dayOfWeek.isoDayNumber - 1

    fun weekdayLong(date: LocalDate, locale: Locale): String = (weekdaysLong[locale] ?: weekdaysLong.getValue(Locale.Da))[index(date)]

    fun weekdayShort(date: LocalDate, locale: Locale): String = (weekdaysShort[locale] ?: weekdaysShort.getValue(Locale.Da))[index(date)]

    /** { weekday: "long", day: "numeric", month: "long" } — "mandag den 5. oktober". */
    fun weekdayDayMonthLong(date: LocalDate, locale: Locale): String {
        val weekday = weekdayLong(date, locale)
        val month = CaptureDates.monthLong(date.monthNumber, locale)
        val day = date.dayOfMonth
        return when (locale) {
            Locale.Da -> "$weekday den $day. $month"
            Locale.De -> "$weekday, $day. $month"
            Locale.No -> "$weekday $day. $month"
            else -> "$weekday $day $month"
        }
    }

    /** { day: "numeric", month: "numeric" } — "5.10". */
    fun dayMonthNumeric(date: LocalDate, locale: Locale): String {
        val d = date.dayOfMonth
        val m = date.monthNumber
        fun pad(n: Int) = n.toString().padStart(2, '0')
        return when (locale) {
            Locale.Da -> "$d.$m"
            Locale.De, Locale.No -> "$d.$m."
            Locale.En, Locale.Fr -> "${pad(d)}/${pad(m)}"
            Locale.Nl -> "$d-$m"
            Locale.Sv -> "$d/$m"
        }
    }
}

/** A JS number's toString(): "62" for whole numbers, "62.5" otherwise. */
private fun pulseJsNumber(value: Double): String =
    if (value == floor(value) && abs(value) < 1e15) value.toLong().toString() else value.toString()

@Serializable
private data class PulseSampleDto(val at: String, val bpm: Double)

@Serializable
private data class PulseWeekActivityDto(val startedAt: String, val durationMinutes: Double = 0.0, val sportType: String = "")

@Serializable
private data class PulseAlternativeDto(val sport: String, val label: String)

@Serializable
private data class PulseSuggestionDto(
    val sport: String,
    val label: String,
    val confidence: Double = 0.0,
    val basis: String = "pattern",
    val shape: List<String> = emptyList(),
    val alternatives: List<PulseAlternativeDto> = emptyList(),
)

@Serializable
private data class PulsePromptDto(
    val startedAt: String,
    val endedAt: String,
    val durationMinutes: Double = 0.0,
    val extraKcal: Double = 0.0,
    val peakBpm: Double = 0.0,
    val restingBpm: Double = 0.0,
    val windowStart: String,
    val windowEnd: String,
    val samples: List<PulseSampleDto> = emptyList(),
    val weekActivities: List<PulseWeekActivityDto> = emptyList(),
    val suggestion: PulseSuggestionDto? = null,
)

/** The parsed spike plus the raw JSON, so the numbers go back to the server untouched. */
private class PulsePrompt(val dto: PulsePromptDto, val raw: JsonObject)

private class PulsePromptCounters {
    var outcome = "later"
    var shown = 0
}

private suspend fun fetchPulseSpike(): PulsePrompt? = try {
    val spike = Api.get("/api/activities/spike").obj("spike")
    if (spike == null) null else PulsePrompt(ApiJson.decodeFromJsonElement(PulsePromptDto.serializer(), spike), spike)
} catch (e: Exception) {
    null
}

@Composable
fun HomeHeartRateSpikePrompt() {
    val scope = rememberCoroutineScope()
    var spike by remember { mutableStateOf<PulsePrompt?>(null) }
    val counters = remember { PulsePromptCounters() }

    fun load() {
        scope.launch {
            val next = fetchPulseSpike() ?: return@launch
            counters.shown += 1
            counters.outcome = "later"
            spike = next
        }
    }

    LaunchedEffect(Unit) {
        if (!HomeSessionFlags.has(PULSE_LATER_KEY)) load()
    }

    val current = spike ?: return
    key(current.dto.startedAt) {
        PulseSheet(
            current,
            onClose = {
                spike = null
                // Swipe/scrim = "later": asked again next time, but not again in this session.
                if (counters.outcome == "later") HomeSessionFlags.set(PULSE_LATER_KEY)
                else if (counters.shown < MAX_PROMPTS_PER_VISIT) load()
            },
            onOutcome = { counters.outcome = it },
        )
    }
}

@Composable
private fun PulseSheet(spike: PulsePrompt, onClose: () -> Unit, onOutcome: (String) -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    val dto = spike.dto

    val started = CaptureDates.local(dto.startedAt) ?: CaptureDates.nowLocal()
    val dayDiff = started.date.daysUntil(CaptureDates.today())
    val dateText = HomeIntl.weekdayDayMonthLong(started.date, t.locale)
    val timeText = CaptureDates.time(started, t.locale)
    val day = when {
        dayDiff <= 0 -> t.t("activity.today")
        dayDiff == 1 -> t.t("activity.yesterday")
        else -> t.t("activity.onDate", "date" to dateText)
    }

    suspend fun answer(activityId: String?) {
        onOutcome(if (activityId != null) "answered" else "skipped")
        val body = buildMap<String, JsonElement> {
            spike.raw["startedAt"]?.let { put("startedAt", it) }
            spike.raw["endedAt"]?.let { put("endedAt", it) }
            spike.raw["extraKcal"]?.let { put("extraKcal", it) }
            if (activityId != null) put("activityId", JsonPrimitive(activityId))
        }
        try {
            Api.post("/api/activities/spike", JsonObject(body))
        } catch (e: Exception) {
        }
    }

    HcBottomSheet(
        onDismiss = onClose,
        title = t.t("activity.pulseTitle", "day" to day),
        size = HcSheetSize.Full,
        scrollable = true,
        footer = {
            val close = LocalHcSheetClose.current
            FoodSheetSkipButton(
                t.t("activity.skip"),
                onClick = {
                    scope.launch {
                        answer(null)
                        close()
                    }
                },
                enabled = !busy,
            )
        },
    ) {
        val close = LocalHcSheetClose.current

        fun save(sportType: String) {
            busy = true
            failed = false
            scope.launch {
                try {
                    val body = buildMap<String, JsonElement> {
                        put("sportType", JsonPrimitive(sportType))
                        spike.raw["startedAt"]?.let { put("startedAt", it) }
                        spike.raw["durationMinutes"]?.let { put("durationMinutes", it) }
                        spike.raw["extraKcal"]?.let { put("caloriesBurned", it) }
                    }
                    val response = Api.post("/api/activities", JsonObject(body))
                    val id = response.obj("activity").str("id") ?: throw IllegalStateException("activity")
                    NativeHooks.onRegistrationChanged()
                    answer(id)
                    close()
                } catch (e: Exception) {
                    failed = true
                } finally {
                    busy = false
                }
            }
        }

        val whenText = t.t("activity.pulseWhen", "date" to dateText, "time" to timeText, "kcal" to dto.extraKcal.roundToLong())
        val hint = t.t(
            "activity.spikeHint",
            "peak" to pulseJsNumber(dto.peakBpm),
            "rest" to pulseJsNumber(dto.restingBpm),
            "minutes" to pulseJsNumber(dto.durationMinutes),
        )
        Column(Modifier.fillMaxWidth().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            HcText("$whenText $hint", HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            HeartRateSpikeChart(dto.samples, dto.windowStart, dto.windowEnd, dto.startedAt, dto.endedAt)
            PulseWeekStrip(dto.weekActivities, dto.startedAt)
            dto.suggestion?.let { suggestion -> PulseSuggestionCard(suggestion, busy) { save(it) } }
            HcText(t.t("activity.pulseQuestion"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
            ActivityPicker(onPick = { save(it.key) }, busy = busy)
            if (failed) HcText(t.t("activity.saveFailed"), HcTypeRoles.Small, color = HcColors.RedDark)
        }
    }
}

// ---------------------------------------------------------------------------
// src/components/activity/HeartRateSpikeChart.tsx — the pulse over the four
// hours with the spike shaded; touching shows time + pulse.

private const val CHART_W = 320f
private const val CHART_H = 150f
private const val CHART_PAD_TOP = 12f
private const val CHART_PAD_RIGHT = 8f
private const val CHART_PAD_BOTTOM = 22f
private const val CHART_PAD_LEFT = 30f

private fun pulseMillis(iso: String): Double = (CaptureDates.parseInstant(iso)?.toEpochMilliseconds() ?: 0L).toDouble()

/** new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }) */
private fun pulseTimeLabel(ms: Double): String =
    CaptureDates.time(Instant.fromEpochMilliseconds(ms.toLong()).toLocalDateTime(CaptureDates.zone), Locale.Da)

/** Math.round */
private fun pulseRound(value: Double): Double = floor(value + 0.5)

@Composable
private fun HeartRateSpikeChart(samples: List<PulseSampleDto>, windowStart: String, windowEnd: String, spikeStart: String, spikeEnd: String) {
    var hover by remember { mutableStateOf<Int?>(null) }
    val t0 = pulseMillis(windowStart)
    val t1 = pulseMillis(windowEnd)
    val points = remember(samples) { samples.map { pulseMillis(it.at) to it.bpm } }
    val maxBpm = max(120.0, points.maxOfOrNull { it.second } ?: 120.0)
    val minBpm = max(0.0, min(50.0, points.minOfOrNull { it.second } ?: 50.0) - 5)
    val span = if (t1 - t0 == 0.0) 1.0 else t1 - t0
    fun x(t: Double): Float = (CHART_PAD_LEFT + ((t - t0) / span) * (CHART_W - CHART_PAD_LEFT - CHART_PAD_RIGHT)).toFloat()
    fun y(bpm: Double): Float =
        (CHART_PAD_TOP + (1 - (bpm - minBpm) / (maxBpm - minBpm)) * (CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM)).toFloat()
    val ticks = (0..4).map { t0 + ((t1 - t0) * it) / 4 }
    val yTicks = listOf(
        pulseRound(minBpm / 10) * 10 + 10,
        pulseRound(((minBpm + maxBpm) / 2) / 10) * 10,
        floor(maxBpm / 10) * 10,
    )
    val hovered = hover?.let { points.getOrNull(it) }

    fun onMove(px: Float, widthPx: Int) {
        if (points.isEmpty() || widthPx <= 0) return
        val time = t0 + (((px / widthPx) * CHART_W - CHART_PAD_LEFT) / (CHART_W - CHART_PAD_LEFT - CHART_PAD_RIGHT)) * (t1 - t0)
        var best = 0
        points.forEachIndexed { i, p -> if (abs(p.first - time) < abs(points[best].first - time)) best = i }
        hover = best
    }

    Column(Modifier.fillMaxWidth()) {
        ViewBoxCanvas(
            CHART_W,
            CHART_H,
            Modifier
                .semantics { contentDescription = "Puls over fire timer" }
                .pointerInput(points) {
                    // touch-none: pointerdown/move pick the nearest sample; leaving (lifting) clears it.
                    awaitEachGesture {
                        val down = awaitFirstDown()
                        down.consume()
                        onMove(down.position.x, size.width)
                        while (true) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break
                            if (!change.pressed) break
                            change.consume()
                            onMove(change.position.x, size.width)
                        }
                        hover = null
                    }
                },
        ) {
            val sx = x(pulseMillis(spikeStart))
            val ex = x(pulseMillis(spikeEnd))
            rect(sx, CHART_PAD_TOP, max(2f, ex - sx), CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM, HcColors.Green, alpha = 0.15f, rx = 4f)
            yTicks.forEach { v ->
                line(CHART_PAD_LEFT, y(v), CHART_W - CHART_PAD_RIGHT, y(v), HcColors.TanDark, 1f)
                text(pulseJsNumber(v), CHART_PAD_LEFT - 4, y(v) + 3, 9f, HcColors.TextSecondary, anchor = TextAnchor.End)
            }
            polyline(points.map { Offset(x(it.first), y(it.second)) }, HcColors.GreenDark, 2f)
            ticks.forEachIndexed { i, tick ->
                val anchor = when (i) {
                    0 -> TextAnchor.Start
                    ticks.lastIndex -> TextAnchor.End
                    else -> TextAnchor.Middle
                }
                text(pulseTimeLabel(tick), x(tick), CHART_H - 6, 10f, HcColors.TextSecondary, anchor = anchor)
            }
            if (hovered != null) {
                line(x(hovered.first), CHART_PAD_TOP, x(hovered.first), CHART_H - CHART_PAD_BOTTOM, HcColors.TextSecondary, 1f)
                circle(x(hovered.first), y(hovered.second), 4f, HcColors.GreenDark, strokeColor = HcColors.Cream, strokeWidth = 2f)
            }
        }
        Box(Modifier.fillMaxWidth().height(20.dp), contentAlignment = Alignment.Center) {
            HcText(
                if (hovered != null) "${pulseTimeLabel(hovered.first)} · ${pulseJsNumber(hovered.second)} bpm" else "",
                HcTypeRoles.Small,
                Modifier.fillMaxWidth(),
                color = HcColors.TextSecondary,
                align = TextAlign.Center,
            )
        }
    }
}

// ---------------------------------------------------------------------------
// src/components/activity/PulseWeekStrip.tsx + src/lib/pulse-week.ts — the
// week of the spike, Monday–Sunday: registered sport is ticked off with its
// time; the spike asked about stands as "?" with its time.

private const val WEEK_MAX_ENTRIES = 3

private class PulseWeekEntry(val activity: Boolean, val at: LocalDateTime)

private class PulseWeekDay(
    val date: LocalDate,
    val isToday: Boolean,
    val isFuture: Boolean,
    val isAskedDay: Boolean,
    val entries: List<PulseWeekEntry>,
)

/** buildWeek(anchor = askedAt, activities, askedAt) in the device's local time. */
private fun buildPulseWeek(asked: LocalDateTime, activities: List<PulseWeekActivityDto>): List<PulseWeekDay> {
    val today = CaptureDates.today()
    val monday = asked.date.minus(asked.date.dayOfWeek.isoDayNumber - 1, DateTimeUnit.DAY)
    val starts = activities.mapNotNull { CaptureDates.local(it.startedAt) }
    return List(7) { index ->
        val date = monday.plus(index, DateTimeUnit.DAY)
        val entries = starts.filter { it.date == date }.map { PulseWeekEntry(true, it) }.toMutableList()
        if (date == asked.date) entries += PulseWeekEntry(false, asked)
        entries.sortBy { it.at }
        PulseWeekDay(date, date == today, date > today, date == asked.date, entries)
    }
}

/** A round marker: filled green-dark with a white glyph, or a dashed green-dark ring. */
@Composable
private fun PulseWeekMarker(done: Boolean, size: Dp, iconSize: Dp, ringWidth: Dp) {
    Box(
        Modifier.size(size).clip(CircleShape).let { if (done) it.background(HcColors.GreenDark) else it },
        contentAlignment = Alignment.Center,
    ) {
        if (!done) {
            Canvas(Modifier.size(size)) {
                val w = ringWidth.toPx()
                drawCircle(
                    HcColors.GreenDark,
                    radius = (this.size.minDimension - w) / 2,
                    style = Stroke(width = w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(w * 2, w * 1.5f))),
                )
            }
        }
        HcIcon(if (done) "Check" else "QuestionMark", size = iconSize, color = if (done) HcColors.White else HcColors.GreenDark, stroke = 3f)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PulseWeekStrip(activities: List<PulseWeekActivityDto>, askedAt: String) {
    val t = LocalTranslator.current
    val locale = t.locale
    val asked = CaptureDates.local(askedAt) ?: CaptureDates.nowLocal()
    val days = remember(activities, askedAt) { buildPulseWeek(asked, activities) }
    val weekTitle = t.t("activity.weekTitle")

    Column(Modifier.fillMaxWidth().semantics { contentDescription = weekTitle }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HcText(weekTitle, HcTypeRoles.Small, bold = true, color = HcColors.Black)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            days.forEach { day ->
                val visible = day.entries.take(WEEK_MAX_ENTRIES)
                val hidden = day.entries.size - visible.size
                val label = (
                    listOf(HomeIntl.weekdayDayMonthLong(day.date, locale)) +
                        day.entries.map { entry ->
                            t.t(if (entry.activity) "activity.weekDayDone" else "activity.weekDayAsked", "time" to CaptureDates.time(entry.at, locale))
                        }
                    ).joinToString(", ")
                val shape = RoundedCornerShape(HcDimens.RadiusCard)
                Column(
                    Modifier
                        .weight(1f)
                        .semantics { contentDescription = label }
                        .alpha(if (day.isFuture) 0.5f else 1f)
                        .clip(shape)
                        .let { if (day.isAskedDay) it.background(HcColors.Tan, shape) else it }
                        .padding(horizontal = 2.dp, vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    HcText(
                        HomeIntl.weekdayShort(day.date, locale).uppercase(),
                        HcTypeRoles.Caption,
                        Modifier.fillMaxWidth(),
                        color = HcColors.TextSecondary,
                        align = TextAlign.Center,
                        maxLines = 1,
                    )
                    HcText(
                        HomeIntl.dayMonthNumeric(day.date, locale),
                        HcTypeRoles.Caption,
                        Modifier.fillMaxWidth(),
                        color = if (day.isToday) HcColors.GreenDark else HcColors.Black,
                        bold = day.isToday,
                        align = TextAlign.Center,
                        maxLines = 1,
                    )
                    if (visible.isEmpty() && !day.isFuture) {
                        Box(Modifier.padding(top = 4.dp).size(6.dp).clip(CircleShape).background(HcColors.TanDark))
                    }
                    visible.forEach { entry ->
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            PulseWeekMarker(entry.activity, 24.dp, 14.dp, 2.dp)
                            HcText(
                                CaptureDates.time(entry.at, locale),
                                HcTypeRoles.Caption,
                                color = if (entry.activity) HcColors.TextSecondary else HcColors.Black,
                                bold = !entry.activity,
                                maxLines = 1,
                            )
                        }
                    }
                    if (hidden > 0) HcText("+$hidden", HcTypeRoles.Caption, color = HcColors.TextSecondary)
                }
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                PulseWeekMarker(true, 16.dp, 10.dp, 1.dp)
                HcText(t.t("activity.weekLegendDone"), HcTypeRoles.Caption, color = HcColors.TextSecondary)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                PulseWeekMarker(false, 16.dp, 10.dp, 1.dp)
                HcText(t.t("activity.weekLegendAsked"), HcTypeRoles.Caption, color = HcColors.TextSecondary)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// src/components/activity/PulseSuggestionCard.tsx — the robot's guess (only
// when it has enough data); one tap saves the activity.

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PulseSuggestionCard(suggestion: PulseSuggestionDto, busy: Boolean, onPick: (String) -> Unit) {
    val t = LocalTranslator.current
    val shapeText = suggestion.shape.joinToString(", ") { t.t("activity.shape.$it") }
    val why = t.t(
        if (suggestion.basis == "personal") "activity.suggestWhyPersonal" else "activity.suggestWhyPattern",
        "sport" to suggestion.label,
        "shape" to shapeText,
    )
    val title = t.t("activity.suggestTitle", "sport" to suggestion.label)
    val panel = RoundedCornerShape(HcDimens.RadiusCard)
    // .hf-panel
    Column(
        Modifier
            .fillMaxWidth()
            .semantics { contentDescription = title }
            .clip(panel)
            .background(HcColors.Surface, panel)
            .border(1.dp, HcColors.Nav, panel)
            .padding(HcDimens.SpaceBlock),
        verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline),
    ) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(HcColors.Tan), contentAlignment = Alignment.Center) {
                HcIcon(sportIcon(suggestion.sport), size = 22.dp, color = HcColors.GreenDark)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                HcText(title, HcTypeRoles.Body, bold = true, color = HcColors.Black)
                HcText(why, HcTypeRoles.Small, color = HcColors.TextSecondary)
            }
        }
        HcButton(t.t("activity.suggestYes", "sport" to suggestion.label), onClick = { onPick(suggestion.sport) }, enabled = !busy)
        if (suggestion.alternatives.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HcText(t.t("activity.suggestMaybe"), HcTypeRoles.Small, Modifier.align(Alignment.CenterVertically), color = HcColors.TextSecondary)
                suggestion.alternatives.forEach { alternative ->
                    Box(
                        Modifier
                            .alpha(if (busy) 0.6f else 1f)
                            .clip(RoundedCornerShape(50))
                            .background(HcColors.Tan)
                            .clickable(enabled = !busy) { onPick(alternative.sport) }
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                    ) { HcText(alternative.label, HcTypeRoles.Small, color = HcColors.Black) }
                }
            }
        }
    }
}

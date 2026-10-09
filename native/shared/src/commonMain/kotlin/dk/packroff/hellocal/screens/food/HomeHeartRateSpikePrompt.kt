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
internal data class PulsePromptDto(
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

/** A pulse event (src/lib/pulse-candidates.ts PulseEvent): the spike plus status and chosen workout type. */
internal class PulseEvent(
    val dto: PulsePromptDto,
    val raw: JsonObject,
    val status: String,
    val sportType: String?,
    val sportLabel: String?,
    val activityId: String?,
) {
    val startedAt: String get() = dto.startedAt
}

private fun parsePulseEvent(raw: JsonObject): PulseEvent = PulseEvent(
    ApiJson.decodeFromJsonElement(PulsePromptDto.serializer(), raw),
    raw,
    raw.str("status") ?: "PENDING",
    raw.str("sportType"),
    raw.str("sportLabel"),
    raw.str("activityId"),
)

/** GET /api/activities/spike (unanswered, 7 days) or /api/activities/spike/events (all, 7 days); oldest first. */
internal suspend fun fetchPulseEvents(path: String): List<PulseEvent> = try {
    (Api.get(path).arr("events") ?: emptyList()).mapNotNull { (it as? JsonObject)?.let(::parsePulseEvent) }
} catch (e: Exception) {
    emptyList()
}

@Composable
fun HomeHeartRateSpikePrompt() {
    var events by remember { mutableStateOf<List<PulseEvent>>(emptyList()) }
    var open by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (HomeSessionFlags.has(PULSE_LATER_KEY)) return@LaunchedEffect
        val loaded = fetchPulseEvents("/api/activities/spike")
        if (loaded.isNotEmpty()) {
            events = loaded
            open = true
        }
    }

    if (!open || events.isEmpty()) return
    PulseEventSheet(
        events = events,
        initialIndex = events.size - 1,
        mode = "prompt",
        onClose = {
            HomeSessionFlags.set(PULSE_LATER_KEY)
            open = false
        },
        onChanged = {},
    )
}

/**
 * src/components/activity/PulseEventsProvider.tsx — the calendar's red hearts:
 * days with a high pulse in the last 7 days. State is process-wide (Compose
 * snapshot state) so the row/cell composables can read it without plumbing;
 * [Host] loads the events and shows the sheet.
 */
internal object PulseCalendar {
    private var events by mutableStateOf<List<PulseEvent>>(emptyList())
    private var openIndex by mutableStateOf<Int?>(null)

    fun eventsOn(date: LocalDate): List<PulseEvent> =
        events.filter { (CaptureDates.local(it.startedAt)?.date) == date }

    fun open(event: PulseEvent) {
        openIndex = events.indexOfFirst { it.startedAt == event.startedAt }.takeIf { it >= 0 }
    }

    @Composable
    fun Host() {
        val scope = rememberCoroutineScope()
        fun load() {
            scope.launch { events = fetchPulseEvents("/api/activities/spike/events") }
        }
        LaunchedEffect(Unit) { load() }
        val index = openIndex ?: return
        if (events.isEmpty()) return
        PulseEventSheet(events, index, "calendar", onClose = { openIndex = null }, onChanged = { load() })
    }
}

/** Red heart for a day with a high pulse; tapping opens the pulse sheet (not the day). */
@Composable
internal fun PulseHeartMark(date: LocalDate, size: Dp = 18.dp, modifier: Modifier = Modifier) {
    val t = LocalTranslator.current
    val events = PulseCalendar.eventsOn(date)
    if (events.isEmpty()) return
    val target = events.firstOrNull { it.status == "PENDING" } ?: events.last()
    Box(
        modifier
            .semantics { contentDescription = t.t("activity.heartAria") }
            .clickable { PulseCalendar.open(target) },
    ) { HcIcon("HeartFilled", size = size, color = HcColors.RedDark) }
}

@Composable
private fun PulseChevronButton(icon: String, label: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .size(40.dp)
            .alpha(if (enabled) 1f else 0.25f)
            .clip(CircleShape)
            .semantics { contentDescription = label }
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { HcIcon(icon, size = 24.dp, color = HcColors.Text) }
}

/** Time of the highest pulse inside the spike (PulseEventSheet.peakAt). */
private fun pulsePeak(event: PulseEvent): Pair<Double, Double> {
    val start = pulseMillis(event.dto.startedAt)
    val end = pulseMillis(event.dto.endedAt)
    var best: Pair<Double, Double>? = null
    for (sample in event.dto.samples) {
        val at = pulseMillis(sample.at)
        if (at < start || at > end) continue
        if (best == null || sample.bpm > best.second) best = at to sample.bpm
    }
    return best ?: (((start + end) / 2) to event.dto.peakBpm)
}

private fun pulseClock(ms: Double, locale: Locale): String =
    CaptureDates.time(Instant.fromEpochMilliseconds(ms.toLong()).toLocalDateTime(CaptureDates.zone), locale)

/**
 * src/components/activity/PulseEventSheet.tsx — one pulse event: date and
 * interval (small) with the peak time in the middle (large, bold), the graph,
 * and the workout-type row ("Angiv træningstype" opens a picker sheet).
 * "prompt" browses the unanswered ones; "calendar" keeps all of them.
 */
@Composable
internal fun PulseEventSheet(events: List<PulseEvent>, initialIndex: Int, mode: String, onClose: () -> Unit, onChanged: () -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var list by remember { mutableStateOf(events) }
    var index by remember { mutableStateOf(initialIndex.coerceIn(0, events.size - 1)) }
    var picking by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }

    val event = list[index.coerceIn(0, list.size - 1)]
    val peak = remember(event) { pulsePeak(event) }
    val dto = event.dto
    val started = CaptureDates.local(dto.startedAt) ?: CaptureDates.nowLocal()
    val dateText = HomeIntl.weekdayDayMonthLong(started.date, t.locale)

    fun replace(updated: PulseEvent) {
        if (mode == "calendar") {
            list = list.map { if (it.startedAt == updated.startedAt) updated else it }
            return
        }
        val rest = list.filter { it.startedAt != updated.startedAt }
        if (rest.isEmpty()) {
            onClose()
            return
        }
        list = rest
        index = min(index, rest.size - 1)
    }

    fun choose(sportType: String, label: String) {
        busy = true
        failed = false
        scope.launch {
            try {
                if (event.status == "ANSWERED" && event.activityId != null) {
                    val change = JsonObject(mapOf("activityId" to JsonPrimitive(event.activityId), "sportType" to JsonPrimitive(sportType)))
                    Api.post("/api/activities/spike", JsonObject(mapOf("changeSport" to change)))
                    replace(PulseEvent(dto, event.raw, "ANSWERED", sportType, label, event.activityId))
                } else {
                    val body = buildMap<String, JsonElement> {
                        put("sportType", JsonPrimitive(sportType))
                        event.raw["startedAt"]?.let { put("startedAt", it) }
                        event.raw["durationMinutes"]?.let { put("durationMinutes", it) }
                        event.raw["extraKcal"]?.let { put("caloriesBurned", it) }
                    }
                    val id = Api.post("/api/activities", JsonObject(body)).obj("activity").str("id") ?: throw IllegalStateException("activity")
                    NativeHooks.onRegistrationChanged()
                    val answer = buildMap<String, JsonElement> {
                        event.raw["startedAt"]?.let { put("startedAt", it) }
                        event.raw["endedAt"]?.let { put("endedAt", it) }
                        event.raw["extraKcal"]?.let { put("extraKcal", it) }
                        put("activityId", JsonPrimitive(id))
                    }
                    Api.post("/api/activities/spike", JsonObject(answer))
                    replace(PulseEvent(dto, event.raw, "ANSWERED", sportType, label, id))
                }
                picking = false
                onChanged()
            } catch (e: Exception) {
                failed = true
            } finally {
                busy = false
            }
        }
    }

    HcBottomSheet(
        onDismiss = onClose,
        title = null,
        size = HcSheetSize.Full,
        scrollable = true,
        footer = {
            val close = LocalHcSheetClose.current
            if (list.size > 1) {
                HcText("${index + 1}/${list.size}", HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
            if (mode == "prompt") {
                HcButton(t.t("weighIn.later"), onClick = { close() })
                FoodSheetSkipButton(
                    t.t("activity.skip"),
                    onClick = {
                        busy = true
                        scope.launch {
                            try {
                                val body = buildMap<String, JsonElement> {
                                    event.raw["startedAt"]?.let { put("startedAt", it) }
                                    event.raw["endedAt"]?.let { put("endedAt", it) }
                                    event.raw["extraKcal"]?.let { put("extraKcal", it) }
                                }
                                Api.post("/api/activities/spike", JsonObject(body))
                            } catch (e: Exception) {
                            }
                            busy = false
                            replace(event)
                        }
                    },
                    enabled = !busy,
                )
            } else {
                HcButton(t.t("common.close"), onClick = { close() })
            }
        },
    ) {
        Column(Modifier.fillMaxWidth().padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (list.size > 1) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    PulseChevronButton("ChevronLeft", t.t("activity.older"), enabled = index > 0) { index -= 1 }
                    HcText(t.t("activity.pulseHeading"), HcTypeRoles.Body, color = HcColors.Black)
                    PulseChevronButton("ChevronRight", t.t("activity.newer"), enabled = index < list.size - 1) { index += 1 }
                }
            }
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                HcText(dateText, HcTypeRoles.Small, color = HcColors.TextSecondary, align = TextAlign.Center)
                Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.Bottom) {
                    HcText(pulseClock(pulseMillis(dto.startedAt), t.locale), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    HcText(pulseClock(peak.first, t.locale), HcTypeRoles.Hero, bold = true, color = HcColors.Black)
                    HcText(pulseClock(pulseMillis(dto.endedAt), t.locale), HcTypeRoles.Small, color = HcColors.TextSecondary)
                }
                HcText(t.t("activity.peakBpm", "peak" to pulseRound(peak.second).toLong()), HcTypeRoles.Small, color = HcColors.TextSecondary, align = TextAlign.Center)
            }
            HeartRateSpikeChart(dto.samples, dto.windowStart, dto.windowEnd, dto.startedAt, dto.endedAt)
            if (event.status == "PENDING") {
                dto.suggestion?.let { suggestion -> PulseSuggestionCard(suggestion, busy) { choose(it, suggestion.label) } }
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(HcDimens.RadiusCard))
                    .background(HcColors.Tan)
                    .clickable { picking = true }
                    .height(48.dp)
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                HcIcon(if (event.sportType != null) sportIcon(event.sportType) else "Activity", size = 20.dp, color = HcColors.Black)
                HcText(
                    event.sportLabel ?: event.sportType ?: t.t("activity.pickType"),
                    HcTypeRoles.Body,
                    Modifier.weight(1f),
                    color = HcColors.Black,
                )
                HcIcon("ChevronRight", size = 20.dp, color = HcColors.Black)
            }
            if (failed) HcText(t.t("activity.saveFailed"), HcTypeRoles.Small, color = HcColors.RedDark)
            PulseWeekStrip(dto.weekActivities, dto.startedAt)
        }
    }

    if (picking) {
        HcBottomSheet(onDismiss = { picking = false }, title = t.t("activity.pickType"), size = HcSheetSize.Full, scrollable = true) {
            Column(Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
                ActivityPicker(onPick = { choose(it.key, it.label) }, busy = busy)
            }
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

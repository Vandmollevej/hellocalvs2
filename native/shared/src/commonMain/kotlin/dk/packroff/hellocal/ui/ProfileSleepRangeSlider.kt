package dk.packroff.hellocal.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import kotlin.math.abs
import kotlin.math.roundToInt

private const val MINUTES_PER_DAY = 24 * 60

/** "HH:MM" for minutes after midnight (wraps over midnight). */
fun profileFormatClock(minutes: Int): String {
    val wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
    return "${(wrapped / 60).toString().padStart(2, '0')}:${(wrapped % 60).toString().padStart(2, '0')}"
}

private fun parseClock(value: String): Int? {
    val match = Regex("^(\\d{1,2})[:.](\\d{2})$").find(value.trim()) ?: return null
    val hours = match.groupValues[1].toInt()
    val mins = match.groupValues[2].toInt()
    if (hours > 23 || mins > 59) return null
    return hours * 60 + mins
}

private enum class SleepHandle { Wake, Bedtime }

/**
 * src/components/hf/SleepRangeSlider.tsx — ONE line for all 24 hours with two
 * handles (wake-up and bedtime) dragged on the same track, snapping to
 * quarter hours. Tapping a time above the track lets you type it.
 */
@Composable
fun ProfileSleepRangeSlider(
    wakeMinutes: Int,
    bedtimeMinutes: Int,
    onChangeWake: (Int) -> Unit,
    onChangeBedtime: (Int) -> Unit,
    bedtimeFirst: Boolean = false,
) {
    var editing by remember { mutableStateOf<SleepHandle?>(null) }
    var editValue by remember { mutableStateOf("") }
    val wake by rememberUpdatedState(wakeMinutes)
    val bedtime by rememberUpdatedState(bedtimeMinutes)
    val onWake by rememberUpdatedState(onChangeWake)
    val onBedtime by rememberUpdatedState(onChangeBedtime)

    fun commitEdit() {
        val handle = editing ?: return
        val parsed = parseClock(editValue)
        if (parsed != null) {
            if (handle == SleepHandle.Wake) onWake(parsed) else onBedtime(parsed)
        }
        editing = null
    }

    @Composable
    fun TimeLabel(handle: SleepHandle) {
        val minutes = if (handle == SleepHandle.Wake) wakeMinutes else bedtimeMinutes
        if (editing == handle) {
            val focus = remember { FocusRequester() }
            val focusManager = LocalFocusManager.current
            var hadFocus by remember { mutableStateOf(false) }
            LaunchedEffect(Unit) { focus.requestFocus() }
            BasicTextField(
                value = editValue,
                onValueChange = { editValue = it },
                singleLine = true,
                textStyle = HcTypeRoles.Small.style(HcColors.Black).copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, textAlign = TextAlign.Center),
                cursorBrush = SolidColor(HcColors.Action),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                modifier = Modifier.width(48.dp).background(HcColors.White, RoundedCornerShape(4.dp)).focusRequester(focus).onFocusChanged {
                    if (hadFocus && !it.isFocused) commitEdit()
                    hadFocus = it.isFocused
                },
            )
        } else {
            HcText(
                profileFormatClock(minutes),
                HcTypeRoles.Small,
                Modifier.clickable {
                    editValue = profileFormatClock(minutes)
                    editing = handle
                }.padding(horizontal = 4.dp),
                bold = true,
                color = HcColors.Black,
            )
        }
    }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 2.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            // Activity: start (= "bedtime") on the left, end (= "wake") on the right.
            if (bedtimeFirst) {
                TimeLabel(SleepHandle.Bedtime)
                TimeLabel(SleepHandle.Wake)
            } else {
                TimeLabel(SleepHandle.Wake)
                TimeLabel(SleepHandle.Bedtime)
            }
        }
        var active by remember { mutableStateOf<SleepHandle?>(null) }
        Box(
            Modifier.fillMaxWidth().height(20.dp).pointerInput(Unit) {
                fun minutesAt(x: Float): Int {
                    val trackWidth = size.width.toFloat().coerceAtLeast(1f)
                    val ratio = (x / trackWidth).coerceIn(0f, 1f)
                    return minOf(MINUTES_PER_DAY - 1, ((ratio * MINUTES_PER_DAY) / 15f).roundToInt() * 15)
                }
                fun update(handle: SleepHandle, x: Float) {
                    val value = minutesAt(x)
                    if (handle == SleepHandle.Wake) onWake(value) else onBedtime(value)
                }
                detectDragGestures(
                    onDragStart = { start ->
                        val trackWidth = size.width.toFloat()
                        val wakeX = wake / MINUTES_PER_DAY.toFloat() * trackWidth
                        val bedX = bedtime / MINUTES_PER_DAY.toFloat() * trackWidth
                        val grab = 24.dp.toPx()
                        val dWake = abs(start.x - wakeX)
                        val dBed = abs(start.x - bedX)
                        active = when {
                            dWake <= grab && dWake <= dBed -> SleepHandle.Wake
                            dBed <= grab -> SleepHandle.Bedtime
                            else -> null
                        }
                        active?.let { update(it, start.x) }
                    },
                    onDragEnd = { active = null },
                    onDragCancel = { active = null },
                ) { change, _ ->
                    active?.let {
                        change.consume()
                        update(it, change.position.x)
                    }
                }
            },
        ) {
            Canvas(Modifier.fillMaxWidth().height(20.dp)) {
                val w = size.width
                val cy = size.height / 2
                val track = 4.dp.toPx()
                val wakeX = wakeMinutes / MINUTES_PER_DAY.toFloat() * w
                val bedX = bedtimeMinutes / MINUTES_PER_DAY.toFloat() * w
                drawLine(HcColors.TanDark, Offset(0f, cy), Offset(w, cy), strokeWidth = track, cap = StrokeCap.Round)
                // Bedtime is in the evening and wake-up in the morning, so the sleep wraps over midnight.
                if (bedX > wakeX) {
                    drawLine(HcColors.Green, Offset(bedX, cy), Offset(w, cy), strokeWidth = track)
                    drawLine(HcColors.Green, Offset(0f, cy), Offset(wakeX, cy), strokeWidth = track)
                } else {
                    drawLine(HcColors.Green, Offset(bedX, cy), Offset(wakeX, cy), strokeWidth = track)
                }
                val radius = 9.dp.toPx()
                for (x in listOf(bedX, wakeX)) {
                    drawCircle(HcColors.White, radius, Offset(x, cy))
                    drawCircle(HcColors.Green, radius - 1.dp.toPx(), Offset(x, cy), style = Stroke(width = 2.dp.toPx()))
                }
            }
        }
    }
}

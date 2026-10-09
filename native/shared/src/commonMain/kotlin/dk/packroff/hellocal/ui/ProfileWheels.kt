package dk.packroff.hellocal.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles

// iOS-style scroll wheels (src/components/ui/WheelPicker.tsx,
// BirthDatePicker.tsx): a bottom sheet with the wheels and a full-width
// "Færdig" button; the value is only committed on "Færdig".

private val WheelItemHeight = 40.dp

/** Danish short month names as the web's MONTHS list (BirthDatePicker.tsx). */
val ProfileShortMonths = listOf("jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec.")

fun profileDaysInMonth(year: Int, month: Int): Int = when (month) {
    2 -> if ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) 29 else 28
    4, 6, 9, 11 -> 30
    else -> 31
}

/** One snapping wheel column; reports the centred option when scrolling stops. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun <T> ProfileWheelColumn(
    options: List<T>,
    selected: T,
    render: (T) -> String,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    val selectedIndex = options.indexOf(selected).coerceAtLeast(0)
    val state = rememberLazyListState(initialFirstVisibleItemIndex = selectedIndex)
    val fling = rememberSnapFlingBehavior(lazyListState = state)
    val itemPx = with(LocalDensity.current) { WheelItemHeight.toPx() }
    val currentOptions by rememberUpdatedState(options)
    val currentSelected by rememberUpdatedState(selected)
    val currentOnSelect by rememberUpdatedState(onSelect)
    val centered by remember(itemPx) {
        derivedStateOf {
            val raw = state.firstVisibleItemIndex + if (state.firstVisibleItemScrollOffset > itemPx / 2) 1 else 0
            raw.coerceIn(0, (currentOptions.size - 1).coerceAtLeast(0))
        }
    }

    // Commit once the wheel has settled (never in the middle of a fling).
    LaunchedEffect(state) {
        snapshotFlow { state.isScrollInProgress }.collect { scrolling ->
            if (!scrolling && currentOptions.isNotEmpty()) {
                val option = currentOptions[centered]
                if (option != currentSelected) currentOnSelect(option)
            }
        }
    }
    // Keep the wheel aligned when the value is set or clamped from outside.
    LaunchedEffect(selectedIndex, options.size) {
        if (!state.isScrollInProgress && centered != selectedIndex) state.scrollToItem(selectedIndex)
    }

    LazyColumn(
        state = state,
        flingBehavior = fling,
        contentPadding = PaddingValues(vertical = WheelItemHeight * 2),
        modifier = modifier.height(WheelItemHeight * 5),
    ) {
        itemsIndexed(options) { index, option ->
            val isCentered = index == centered
            Box(Modifier.fillMaxWidth().height(WheelItemHeight), contentAlignment = Alignment.Center) {
                HcText(
                    render(option),
                    HcTypeRoles.BodyLg,
                    Modifier.alpha(if (isCentered) 1f else 0.5f),
                    color = HcColors.Black,
                    bold = isCentered,
                    align = TextAlign.Center,
                    maxLines = 1,
                )
            }
        }
    }
}

/**
 * The sheet around one or more wheel columns (WheelPicker / BirthDatePicker):
 * tan band behind the centre row, then the full-width "Færdig" button
 * (BottomSheetCloseButton: [onDone] runs, then the sheet slides out and
 * [onDismiss] is called). Swipe down/scrim = cancel. [label] is only the
 * accessible name of the sheet, as on the web.
 */
@Composable
fun ProfileWheelSheet(label: String, onDismiss: () -> Unit, onDone: () -> Unit, columns: @Composable () -> Unit) {
    HcBottomSheet(onDismiss = onDismiss, title = label) {
        val closeSheet = LocalHcSheetClose.current
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.fillMaxWidth()) {
                Box(
                    Modifier.align(Alignment.Center).fillMaxWidth().height(WheelItemHeight).clip(RoundedCornerShape(8.dp)).background(HcColors.Tan),
                )
                columns()
            }
            HcButton("Færdig", onClick = {
                onDone()
                closeSheet()
            })
        }
    }
}

/** src/components/ui/WheelPicker.tsx — button showing "Vælg" or the value; wheel sheet from max to min. */
@Composable
fun ProfileWheelPicker(
    label: String,
    value: Int?,
    min: Int,
    max: Int,
    onChange: (Int) -> Unit,
    unit: String? = null,
    initialScrollValue: Int? = null,
) {
    var open by remember { mutableStateOf(false) }
    val options = remember(min, max) { (max downTo min).toList() }
    var pending by remember { mutableStateOf(value ?: initialScrollValue ?: options[options.size / 2]) }
    ProfileValueButton(
        text = if (value != null) "$value${if (unit != null) " $unit" else ""}" else "Vælg",
        onClick = {
            pending = value ?: initialScrollValue ?: options[options.size / 2]
            open = true
        },
    )
    if (open) {
        ProfileWheelSheet(label, onDismiss = { open = false }, onDone = { onChange(pending) }) {
            ProfileWheelColumn(options, pending, { "$it${if (unit != null) " $unit" else ""}" }, { pending = it }, Modifier.fillMaxWidth())
        }
    }
}

/** A calendar date picked on three wheels (day, month, year) between [minDate] and [maxDate] ("YYYY-MM-DD"). */
@Composable
fun ProfileDateWheelSheet(
    label: String,
    initial: Triple<Int, Int, Int>,
    minDate: Triple<Int, Int, Int>,
    maxDate: Triple<Int, Int, Int>,
    onDismiss: () -> Unit,
    onDone: (Triple<Int, Int, Int>) -> Unit,
    yearsDescending: Boolean = true,
) {
    fun key(d: Triple<Int, Int, Int>) = d.first * 10000 + d.second * 100 + d.third
    fun normalize(d: Triple<Int, Int, Int>): Triple<Int, Int, Int> {
        val day = minOf(d.third, profileDaysInMonth(d.first, d.second))
        val next = Triple(d.first, d.second, day)
        return when {
            key(next) > key(maxDate) -> maxDate
            key(next) < key(minDate) -> minDate
            else -> next
        }
    }
    var draft by remember { mutableStateOf(normalize(initial)) }
    val years = remember(minDate.first, maxDate.first, yearsDescending) {
        if (yearsDescending) (maxDate.first downTo minDate.first).toList() else (minDate.first..maxDate.first).toList()
    }
    val days = (1..profileDaysInMonth(draft.first, draft.second)).toList()
    ProfileWheelSheet(label, onDismiss = onDismiss, onDone = { onDone(draft) }) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(0.dp)) {
            ProfileWheelColumn(days, draft.third, { "$it." }, { draft = normalize(Triple(draft.first, draft.second, it)) }, Modifier.weight(1f))
            ProfileWheelColumn((1..12).toList(), draft.second, { ProfileShortMonths[it - 1] }, { draft = normalize(Triple(draft.first, it, draft.third)) }, Modifier.weight(1.4f))
            ProfileWheelColumn(years, draft.first, { it.toString() }, { draft = normalize(Triple(it, draft.second, draft.third)) }, Modifier.weight(1.4f))
        }
    }
}

/** A clock time on two wheels (hours, minutes); value and result in minutes after midnight. */
@Composable
fun ProfileTimeWheelSheet(label: String, minutes: Int, onDismiss: () -> Unit, onDone: (Int) -> Unit) {
    var hour by remember { mutableStateOf((minutes / 60).coerceIn(0, 23)) }
    var minute by remember { mutableStateOf((minutes % 60).coerceIn(0, 59)) }
    ProfileWheelSheet(label, onDismiss = onDismiss, onDone = { onDone(hour * 60 + minute) }) {
        Row(Modifier.fillMaxWidth()) {
            ProfileWheelColumn((0..23).toList(), hour, { it.toString().padStart(2, '0') }, { hour = it }, Modifier.weight(1f))
            ProfileWheelColumn((0..59).toList(), minute, { it.toString().padStart(2, '0') }, { minute = it }, Modifier.weight(1f))
        }
    }
}

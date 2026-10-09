package dk.packroff.hellocal.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRole
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CalendarWaterGlassIcon
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon

// Small building blocks shared by the calendar's views (month/week/list, day
// view and hour overlay).

// The calendar's app bar is the shared HcAppBar (icon = view-switch button).

/** Full-screen overlays (day view, hour list) must not let taps through to the calendar below. */
internal fun Modifier.blockTouchesBelow(): Modifier = pointerInput(Unit) {
    awaitEachGesture { awaitFirstDown(requireUnconsumed = false) }
}

/** The calendar icon with a small chevron that opens the view menu (Måned/Uge/Liste). */
@Composable
internal fun CalendarViewMenuButton(
    active: CalendarView,
    open: Boolean,
    onToggle: () -> Unit,
    onSelect: (CalendarView) -> Unit,
    onDismiss: () -> Unit,
) {
    val t = LocalTranslator.current
    val density = LocalDensity.current
    Box(Modifier.size(24.dp)) {
        Box(Modifier.size(24.dp).clickable(onClick = onToggle), contentAlignment = Alignment.Center) {
            HcIcon("Calendar", size = 24.dp, stroke = 1.6f, color = HcColors.White, contentDescription = t.t("calendar.switchViewAriaLabel", "view" to t.t(active.labelKey)))
        }
        HcIcon(
            "ChevronDown",
            modifier = Modifier.align(Alignment.BottomCenter).offset(y = 10.dp).rotate(if (open) 180f else 0f),
            size = 12.dp,
            stroke = 2.5f,
            color = HcColors.White,
        )
        if (open) {
            Popup(
                alignment = Alignment.TopStart,
                offset = IntOffset(0, with(density) { 32.dp.roundToPx() }),
                onDismissRequest = onDismiss,
                properties = PopupProperties(focusable = true),
            ) {
                Column(
                    Modifier.width(176.dp).shadow(12.dp, RoundedCornerShape(16.dp)).clip(RoundedCornerShape(16.dp))
                        .background(HcColors.White).border(1.dp, HcColors.TanDark, RoundedCornerShape(16.dp)).padding(6.dp),
                ) {
                    for (option in CalendarView.entries) {
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clip(RoundedCornerShape(12.dp))
                                .clickable { onSelect(option) }.padding(horizontal = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            HcIcon(option.icon, size = 20.dp, stroke = 1.8f, color = HcColors.Black)
                            HcText(t.t(option.labelKey), HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.Black)
                            if (option == active) HcIcon("Check", size = 18.dp, color = HcColors.Black)
                        }
                    }
                }
            }
        }
    }
}

/** .hf-btn-icon with a 22 px chevron (period and day navigation). */
@Composable
internal fun CalendarIconButton(icon: String, description: String, onClick: () -> Unit, size: Dp = 22.dp) {
    Box(
        Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        HcIcon(icon, size = size, color = HcColors.Black, contentDescription = description)
    }
}

internal enum class EnergyChipKind { Intake, Burned, Water }

/**
 * src/components/calendar/EnergyChip.tsx: intake as plain "540 kcal", burned
 * as flame + "+120 kcal", water as glass + cl.
 */
@Composable
internal fun EnergyChip(
    kind: EnergyChipKind,
    value: Double,
    iconSize: Dp = 16.dp,
    role: HcTypeRole = HcTypeRoles.Small,
    color: Color = HcColors.Black,
    bold: Boolean = true,
) {
    val rounded = jsRound(value)
    val text = when (kind) {
        EnergyChipKind.Water -> formatCl(value)
        EnergyChipKind.Burned -> "+$rounded kcal"
        EnergyChipKind.Intake -> "$rounded kcal"
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        when (kind) {
            EnergyChipKind.Water -> CalendarWaterGlassIcon(iconSize, HcColors.Black)
            EnergyChipKind.Burned -> HcIcon("Flame", size = iconSize, color = HcColors.Green)
            EnergyChipKind.Intake -> Unit
        }
        HcText(text, role, color = color, bold = bold, maxLines = 1)
    }
}

internal enum class GoalStatusKind { Met, Missed, None }

/**
 * src/components/calendar/GoalStatusSummary.tsx: exercise bonus, the status
 * row with "Mål: X kcal" in the SAME row, then remaining/exceeded.
 */
@Composable
internal fun GoalStatusSummary(
    status: GoalStatusKind?,
    goalKcal: Double,
    intakeKcal: Double,
    bonusKcal: Double = 0.0,
    month: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val t = LocalTranslator.current
    val bonus = jsRound(bonusKcal)
    val remaining = jsRound(goalKcal + bonusKcal - intakeKcal)
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (bonus > 0) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.End), verticalAlignment = Alignment.CenterVertically) {
                HcIcon("Flame", size = 16.dp, color = HcColors.RedDark)
                HcText(t.t("calendar.exerciseBonus", "amount" to bonus), HcTypeRoles.Body, color = HcColors.Green)
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (status != null) {
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val circle = when (status) {
                        GoalStatusKind.Met -> HcColors.Green
                        GoalStatusKind.Missed -> HcColors.RedDark
                        GoalStatusKind.None -> HcColors.Gray
                    }
                    Box(Modifier.size(20.dp).clip(CircleShape).background(circle), contentAlignment = Alignment.Center) {
                        if (status == GoalStatusKind.Met) HcIcon("Check", size = 13.dp, stroke = 3f, color = HcColors.White)
                        else Box(Modifier.size(8.dp).clip(CircleShape).background(HcColors.White))
                    }
                    HcText(
                        t.t(
                            when (status) {
                                GoalStatusKind.Met -> "calendar.statusWithinGoal"
                                GoalStatusKind.Missed -> "calendar.statusGoalNotMet"
                                GoalStatusKind.None -> "calendar.statusNothingLogged"
                            },
                        ),
                        HcTypeRoles.Body,
                        bold = true,
                        color = HcColors.Black,
                    )
                }
            } else {
                Spacer(Modifier.weight(1f))
            }
            HcText(t.t("calendar.goalLabel", "goal" to jsRound(goalKcal)), HcTypeRoles.Body, color = HcColors.Inactive, maxLines = 1)
        }
        if (remaining >= 0) {
            HcText(
                t.t(if (month) "calendar.remainingMonth" else "calendar.remainingToday", "amount" to remaining),
                HcTypeRoles.Body,
                Modifier.fillMaxWidth(),
                color = HcColors.Black,
                align = TextAlign.End,
            )
        } else {
            HcText(
                t.t("calendar.exceededCalories", "amount" to -remaining),
                HcTypeRoles.Body,
                Modifier.fillMaxWidth(),
                color = HcColors.RedDark,
                bold = true,
                align = TextAlign.End,
            )
        }
    }
}

/** src/components/FoodRow.tsx — one food/product row (44 px tan thumbnail). */
@Composable
internal fun CalendarFoodRow(
    title: String,
    image: String? = null,
    thumbnail: (@Composable () -> Unit)? = null,
    subtitle: (@Composable () -> Unit)? = null,
    right: (@Composable () -> Unit)? = null,
) {
    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            Modifier.size(44.dp).clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan),
            contentAlignment = Alignment.Center,
        ) {
            if (thumbnail != null) thumbnail()
            else if (image != null) HcRemoteImage(image, Modifier.size(44.dp).padding(4.dp), contentScale = ContentScale.Fit)
        }
        Column(Modifier.weight(1f)) {
            HcText(title, HcTypeRoles.Body, color = HcColors.Black, maxLines = 2)
            subtitle?.invoke()
        }
        if (right != null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) { right() }
    }
}

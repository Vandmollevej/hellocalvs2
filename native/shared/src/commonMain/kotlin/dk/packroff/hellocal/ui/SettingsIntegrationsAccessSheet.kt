package dk.packroff.hellocal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlin.math.roundToInt

// src/components/hf/HfAccessSheet.tsx — the iOS "health access" sheet every
// integration page is shown as (docs/DECISIONS.md 2026-09-27). The web copies
// iOS system colours (#007aff, #ff3b30, #f2f2f7 …); here the nearest design
// tokens are used, since screens may not use raw colour values.

/** The Health app's categories (icon + colour) for each data type. */
enum class SettingsAccessCategory { Nutrition, Activity, Body, Heart, Sleep }

/** One data-type switch in an access group. */
class SettingsAccessToggleRow(
    val key: String,
    val label: String,
    val category: SettingsAccessCategory,
    val checked: Boolean,
    val onChange: (Boolean) -> Unit,
)

enum class SettingsAccessTone { Info, Action, Danger }

private val AccessBlue get() = HcColors.Faceid
private val AccessRed get() = HcColors.Danger
private val AccessMuted get() = HcColors.Inactive
private val AccessGroupBg get() = HcColors.Page

@Composable
fun SettingsAccessCategoryIcon(category: SettingsAccessCategory) {
    val (name, color) = when (category) {
        SettingsAccessCategory.Nutrition -> "Apple" to HcColors.Green
        SettingsAccessCategory.Activity -> "Flame" to HcColors.WarningFill
        SettingsAccessCategory.Body -> "Man" to HcColors.Watch
        SettingsAccessCategory.Heart -> "Heart" to HcColors.Danger
        SettingsAccessCategory.Sleep -> "Bed" to HcColors.FaceidSpin
    }
    HcIcon(name, size = 22.dp, stroke = 1.8f, color = color)
}

/**
 * AccessGroup — optional grey title, rounded group, footer below. Each item
 * is one row; a hairline separates rows (inset 52 px like iOS).
 */
@Composable
fun SettingsAccessGroup(
    title: String? = null,
    items: List<@Composable () -> Unit>,
    footer: (@Composable ColumnScope.() -> Unit)? = null,
) {
    Column(Modifier.fillMaxWidth()) {
        if (title != null) {
            HcText(title, HcTypeRoles.BodyLg, Modifier.padding(start = 15.dp, end = 15.dp, top = 30.dp, bottom = 12.dp), color = AccessMuted)
        }
        val shape = RoundedCornerShape(25.dp)
        Column(Modifier.fillMaxWidth().clip(shape).background(AccessGroupBg, shape)) {
            items.forEachIndexed { index, item ->
                if (index > 0) HorizontalDivider(Modifier.padding(start = 52.dp, end = 15.dp), thickness = 1.dp, color = HcColors.Nav)
                item()
            }
        }
        footer?.invoke(this)
    }
}

/** AccessToggleGroup — a titled group of data-type switches. */
@Composable
fun SettingsAccessToggleGroup(title: String, rows: List<SettingsAccessToggleRow>) {
    SettingsAccessGroup(
        title = title,
        items = rows.map<SettingsAccessToggleRow, @Composable () -> Unit> { row ->
            {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 50.dp).padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Box(Modifier.width(20.dp), contentAlignment = Alignment.Center) { SettingsAccessCategoryIcon(row.category) }
                    HcText(row.label, HcTypeRoles.BodyLg, Modifier.weight(1f), color = HcColors.Black)
                    HcToggle(checked = row.checked, onChange = row.onChange)
                }
            }
        },
    )
}

/**
 * AccessRow — blue action, red action or grey info text. Rows with [onClick]
 * are buttons; info rows may carry a [trailing] button and a [mono] value
 * (the one-time device code).
 */
@Composable
fun SettingsAccessRow(
    text: String,
    tone: SettingsAccessTone = SettingsAccessTone.Info,
    onClick: (() -> Unit)? = null,
    enabled: Boolean = true,
    mono: String? = null,
    trailing: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = 50.dp)
            .let { if (onClick != null) it.clickable(enabled = enabled, onClick = onClick) else it }
            .alpha(if (onClick != null && !enabled) 0.5f else 1f)
            .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (onClick != null) {
            HcText(text, HcTypeRoles.BodyLg, Modifier.weight(1f), color = if (tone == SettingsAccessTone.Danger) AccessRed else AccessBlue)
        } else {
            val annotated = buildAnnotatedString {
                append(text)
                if (mono != null) {
                    append(" ")
                    withStyle(SpanStyle(fontFamily = FontFamily.Monospace)) { append(mono) }
                }
            }
            Text(annotated, Modifier.weight(1f), style = HcTypeRoles.Body.style(AccessMuted))
            trailing?.invoke()
        }
    }
}

/** AccessTrailingButton — blue or red text button at the right of a row. */
@Composable
fun SettingsAccessTrailingButton(
    text: String,
    onClick: () -> Unit,
    tone: SettingsAccessTone = SettingsAccessTone.Action,
    enabled: Boolean = true,
) {
    HcText(
        text,
        HcTypeRoles.BodyLg,
        Modifier.alpha(if (enabled) 1f else 0.5f).clickable(enabled = enabled, onClick = onClick),
        color = if (tone == SettingsAccessTone.Danger) AccessRed else AccessBlue,
    )
}

/** AccessFooter — small grey (or red) note under a group. */
@Composable
fun SettingsAccessFooter(text: String, error: Boolean = false) {
    HcText(text, HcTypeRoles.Small, Modifier.fillMaxWidth().padding(start = 15.dp, end = 15.dp, top = 8.dp), color = if (error) AccessRed else AccessMuted)
}

/**
 * HfAccessSheet — full-screen iOS-style sheet: dark backdrop, peeking screen
 * behind, close (X) top right, scrolling body, Allow/Deny buttons at the
 * bottom with the terms bar above them. Dragging the title area down by more
 * than 30 % of the sheet height dismisses it.
 */
@Composable
fun SettingsAccessSheet(
    title: String,
    message: String,
    allowLabel: String,
    denyLabel: String,
    onAllow: () -> Unit,
    onDeny: () -> Unit,
    onDismiss: (() -> Unit)? = null,
    icon: (@Composable () -> Unit)? = null,
    heading: String? = null,
    toggleAllLabel: String? = null,
    onToggleAll: (() -> Unit)? = null,
    allowDisabled: Boolean = false,
    denyDisabled: Boolean = false,
    terms: (@Composable () -> Unit)? = null,
    closeLabel: String = "Luk",
    content: @Composable ColumnScope.() -> Unit = {},
) {
    var offset by remember { mutableFloatStateOf(0f) }
    var sheetHeight by remember { mutableIntStateOf(0) }
    val dismiss by rememberUpdatedState(onDismiss)

    Box(Modifier.fillMaxSize().background(HcColors.Black)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            Box(Modifier.fillMaxWidth().weight(1f)) {
                // The screen behind, peeking out above the sheet.
                Box(
                    Modifier.padding(start = 16.dp, end = 16.dp, top = 10.dp).fillMaxWidth().height(24.dp)
                        .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp)).background(HcColors.Nav),
                )
                if (onDismiss != null) {
                    Box(Modifier.fillMaxWidth().height(20.dp).clickable { onDismiss() })
                }
                val sheetShape = RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp)
                Column(
                    Modifier
                        .padding(top = 20.dp)
                        .fillMaxSize()
                        .offset { IntOffset(0, offset.roundToInt()) }
                        .onSizeChanged { sheetHeight = it.height }
                        .clip(sheetShape)
                        .background(HcColors.White, sheetShape),
                ) {
                    Box(Modifier.fillMaxWidth().weight(1f)) {
                        Column(
                            Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                                .padding(start = 22.dp, end = 22.dp, top = 92.dp, bottom = 24.dp),
                        ) {
                            if (icon != null) {
                                Box(
                                    Modifier.align(Alignment.CenterHorizontally).size(79.dp).clip(RoundedCornerShape(18.dp))
                                        .background(HcColors.White).border(1.dp, HcColors.Nav, RoundedCornerShape(18.dp)),
                                    contentAlignment = Alignment.Center,
                                ) { icon() }
                            }
                            if (heading != null) {
                                HcText(heading, HcTypeRoles.PageTitle, Modifier.padding(start = 15.dp, end = 15.dp, top = 36.dp), color = HcColors.Black)
                            }
                            Text(
                                message,
                                Modifier.padding(horizontal = 15.dp),
                                style = HcTypeRoles.PageTitle.style(AccessMuted).copy(fontWeight = FontWeight.Normal),
                            )
                            if (toggleAllLabel != null && onToggleAll != null) {
                                Box(
                                    Modifier.padding(top = 64.dp).fillMaxWidth().height(50.dp).clip(RoundedCornerShape(25.dp))
                                        .background(AccessGroupBg).clickable(onClick = onToggleAll).padding(horizontal = 15.dp),
                                    contentAlignment = Alignment.CenterStart,
                                ) {
                                    HcText(toggleAllLabel, HcTypeRoles.BodyLg, color = AccessBlue)
                                }
                            }
                            content()
                        }

                        // Title bar over the top of the list; dragging it down closes the sheet.
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .background(Brush.verticalGradient(0f to HcColors.White, 0.6f to HcColors.White, 1f to HcColors.White.copy(alpha = 0f)))
                                .pointerInput(onDismiss != null) {
                                    if (onDismiss == null) return@pointerInput
                                    detectVerticalDragGestures(
                                        onDragEnd = {
                                            if (sheetHeight > 0 && offset > sheetHeight * 0.3f) {
                                                offset = 0f
                                                dismiss?.invoke()
                                            } else {
                                                offset = 0f
                                            }
                                        },
                                        onDragCancel = { offset = 0f },
                                        onVerticalDrag = { change, dragAmount ->
                                            change.consume()
                                            offset = (offset + dragAmount).coerceAtLeast(0f)
                                        },
                                    )
                                }
                                .padding(start = 60.dp, end = 60.dp, top = 26.dp, bottom = 18.dp),
                        ) {
                            HcText(title, HcTypeRoles.Title, Modifier.fillMaxWidth(), color = HcColors.Black, align = TextAlign.Center, maxLines = 1)
                        }
                        // Grab handle.
                        Box(
                            Modifier.align(Alignment.TopCenter).padding(top = 6.dp).size(40.dp, 4.dp)
                                .clip(RoundedCornerShape(2.dp)).background(HcColors.Placeholder),
                        )
                        if (onDismiss != null) {
                            Box(
                                Modifier.align(Alignment.TopEnd).padding(top = 14.dp, end = 10.dp).size(44.dp).clip(CircleShape)
                                    .clickable { onDismiss() },
                                contentAlignment = Alignment.Center,
                            ) {
                                Box(Modifier.size(32.dp).clip(CircleShape).background(HcColors.SecondaryHover), contentAlignment = Alignment.Center) {
                                    HcIcon("X", size = 20.dp, stroke = 2.4f, color = HcColors.TextSecondary, contentDescription = closeLabel)
                                }
                            }
                        }
                    }

                    Column(
                        Modifier.fillMaxWidth().background(HcColors.White).navigationBarsPadding()
                            .padding(start = 37.dp, end = 37.dp, top = 8.dp, bottom = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(11.dp),
                    ) {
                        terms?.invoke()
                        SettingsAccessSheetButton(allowLabel, allow = true, enabled = !allowDisabled, onClick = onAllow)
                        SettingsAccessSheetButton(denyLabel, allow = false, enabled = !denyDisabled, onClick = onDeny)
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsAccessSheetButton(label: String, allow: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(25.dp)
    val bg = when {
        allow && enabled -> AccessBlue
        allow -> HcColors.Placeholder
        else -> HcColors.White
    }
    val fg = when {
        allow && enabled -> HcColors.White
        allow -> HcColors.Disabled
        else -> HcColors.Black
    }
    Box(
        Modifier
            .fillMaxWidth()
            .height(49.dp)
            .alpha(if (!allow && !enabled) 0.5f else 1f)
            .let { if (allow) it else it.shadow(8.dp, shape) }
            .clip(shape)
            .background(bg, shape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        HcText(label, HcTypeRoles.Button, color = fg, align = TextAlign.Center)
    }
}

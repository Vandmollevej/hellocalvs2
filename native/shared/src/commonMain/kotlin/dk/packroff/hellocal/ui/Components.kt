package dk.packroff.hellocal.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.screens.food.FoodFamily
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRole
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch

// Native counterparts of the web design classes in src/app/globals.css and
// src/components/hf/*. Screens use these instead of raw Material widgets so a
// design change is made once here (and once on the web).

/** <p className="hf-type-…"> */
@Composable
fun HcText(
    text: String,
    role: HcTypeRole = HcTypeRoles.Body,
    modifier: Modifier = Modifier,
    color: Color? = null,
    bold: Boolean = false,
    align: TextAlign? = null,
    underline: Boolean = false,
    maxLines: Int = Int.MAX_VALUE,
) {
    var style = role.style(color)
    if (bold) style = style.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
    if (underline) style = style.copy(textDecoration = TextDecoration.Underline)
    Text(text, modifier, style = style, textAlign = align, maxLines = maxLines)
}

enum class HcButtonKind { Primary, Secondary, Brand, Danger, Text }

/** .hf-control .hf-btn-primary / -secondary / -brand / -danger (48 px, radius 8). */
@Composable
fun HcButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: HcButtonKind = HcButtonKind.Primary,
    enabled: Boolean = true,
    leading: (@Composable () -> Unit)? = null,
) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    val (bg, fg, border) = when (kind) {
        HcButtonKind.Primary -> Triple(HcColors.Action, HcColors.White, null)
        HcButtonKind.Secondary -> Triple(Color.Transparent, HcColors.Action, BorderStroke(1.5.dp, HcColors.Action))
        HcButtonKind.Brand -> Triple(HcColors.Brand, HcColors.White, null)
        HcButtonKind.Danger -> Triple(Color.Transparent, HcColors.Danger, BorderStroke(1.5.dp, HcColors.Danger))
        HcButtonKind.Text -> Triple(Color.Transparent, HcColors.Action, null)
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(HcDimens.ControlHeight)
            .clip(shape)
            .background(bg, shape)
            .let { if (border != null) it.border(border, shape) else it }
            .alpha(if (enabled || kind == HcButtonKind.Primary) 1f else 0.4f)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = HcDimens.SpaceBlock),
        horizontalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading?.invoke()
        HcText(label, HcTypeRoles.Button, color = if (!enabled && kind == HcButtonKind.Primary) HcColors.Disabled else fg, align = TextAlign.Center)
    }
}

/** src/components/hf/TextField.tsx (variant auth = radius 2, standard = radius card). */
@Composable
fun HcTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    label: String? = null,
    password: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    standard: Boolean = false,
    singleLine: Boolean = true,
) {
    val shape = RoundedCornerShape(if (standard) HcDimens.RadiusCard else 2.dp)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (label != null) HcText(label, HcTypeRoles.Label)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = singleLine,
            textStyle = HcTypeRoles.Input.style(),
            cursorBrush = SolidColor(HcColors.Action),
            visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboardType),
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = HcDimens.ControlHeight)
                .background(HcColors.Page, shape)
                .border(1.dp, HcColors.FieldBorder, shape),
            decorationBox = { inner ->
                Box(Modifier.padding(horizontal = if (standard) 16.dp else 12.dp, vertical = 12.dp), contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Input, color = HcColors.Placeholder)
                    inner()
                }
            },
        )
    }
}

/** .hf-card */
@Composable
fun HcCard(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(HcColors.Card, shape)
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(HcDimens.SpaceBlock),
        verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline),
        content = content,
    )
}

/** .hf-type-section-title — centred bold title between two 1 px lines. */
@Composable
fun HcSectionTitle(text: String, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        HorizontalDivider(Modifier.weight(1f), thickness = 1.dp, color = HcColors.Line)
        HcText(text, HcTypeRoles.SectionTitle, align = TextAlign.Center)
        HorizontalDivider(Modifier.weight(1f), thickness = 1.dp, color = HcColors.Line)
    }
}

/**
 * src/components/hf/ScreenHeader.tsx (.hf-appbar) — green bar: 44 px slot left
 * (back chevron), centred [icon] + white title, 44 px slot right.
 *
 * - `back = true` shows the back chevron (pops the native stack, or [onBack]).
 * - [icon]: the 24 px title icon left of the title (a same-size spacer keeps
 *   the title centred, as on the web).
 * - [leading]: extra element in the left corner (e.g. the meal-language flag) —
 *   in the slot when there is no back arrow, else just right of it.
 * - Right slot: [trailing] when given; else the settings gear when
 *   [settingsButton] (profile page); else the profile circle (ProfileAvatarLink)
 *   when [profile] and logged in — the web shows it on every ScreenHeader.
 */
@Composable
fun HcAppBar(
    title: String,
    back: Boolean = !LocalNavigator.current.isTabRoot,
    onBack: (() -> Unit)? = null,
    trailing: (@Composable RowScope.() -> Unit)? = null,
    background: Color = HcColors.Brand,
    icon: (@Composable () -> Unit)? = null,
    leading: (@Composable () -> Unit)? = null,
    profile: Boolean = true,
    settingsButton: Boolean = false,
) {
    val nav = LocalNavigator.current
    Box(
        Modifier
            .fillMaxWidth()
            .background(background)
            .statusBarsPadding()
            // .hf-appbar--compact: a lower bar on a phone turned to landscape.
            .height(if (LocalCompactLandscape.current) 40.dp else 52.dp)
            .padding(horizontal = 16.dp),
    ) {
        // Centre column (between the two 44 px slots).
        Row(
            Modifier.align(Alignment.Center).fillMaxWidth().padding(horizontal = 44.dp),
            horizontalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) Box(Modifier.size(24.dp), contentAlignment = Alignment.Center) { icon() }
            HcText(title, HcTypeRoles.NavTitle, Modifier.weight(1f, fill = false), align = TextAlign.Center, maxLines = 1)
            if (icon != null) Spacer(Modifier.size(24.dp))
        }
        Row(Modifier.align(Alignment.CenterStart), verticalAlignment = Alignment.CenterVertically) {
            if (back) {
                Box(Modifier.size(44.dp).clickable { (onBack ?: { nav.backOrHome() })() }, contentAlignment = Alignment.Center) {
                    HcChevron(ChevronDirection.Left, color = HcColors.White)
                }
                if (leading != null) Spacer(Modifier.width(4.dp))
            }
            leading?.invoke()
        }
        Row(Modifier.align(Alignment.CenterEnd).height(44.dp), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
            when {
                trailing != null -> trailing(this)
                settingsButton -> Box(Modifier.size(44.dp).clickable { nav.push("/settings") }, contentAlignment = Alignment.Center) {
                    // IconSettings size 39 / stroke 1.54 ≈ a 32 px gear like the profile circle.
                    HcIcon("Settings", size = 39.dp, stroke = 1.54f, color = HcColors.White)
                }
                profile && Session.state == Session.State.LoggedIn -> HcProfileAvatarLink()
            }
        }
    }
}

/**
 * src/components/ProfileAvatarLink.tsx — the one profile circle top right
 * (32 px ProfileCircle in a 44 px tap area), opens /profile. Shows the active
 * family profile's initials; [outlined] adds the 1 px ring for light backgrounds.
 */
@Composable
fun HcProfileAvatarLink(outlined: Boolean = false) {
    val nav = LocalNavigator.current
    val name = FoodFamily.status?.activeProfile?.displayName?.takeIf { it.isNotEmpty() } ?: Session.user?.displayName ?: ""
    Box(Modifier.size(44.dp).clickable { nav.push("/profile") }, contentAlignment = Alignment.Center) {
        if (outlined) {
            Box(Modifier.size(34.dp).clip(CircleShape).background(HcColors.TanDark), contentAlignment = Alignment.Center) {
                ProfileCircle(name)
            }
        } else {
            ProfileCircle(name)
        }
    }
}

/** A screen: app bar on top, scrolling content in the page colour. */
@Composable
fun HcScreen(
    title: String?,
    back: Boolean = !LocalNavigator.current.isTabRoot,
    trailing: (@Composable RowScope.() -> Unit)? = null,
    bottom: (@Composable ColumnScope.() -> Unit)? = null,
    scroll: Boolean = true,
    contentPadding: PaddingValues = PaddingValues(HcDimens.Gutter),
    icon: (@Composable () -> Unit)? = null,
    leading: (@Composable () -> Unit)? = null,
    profile: Boolean = true,
    settingsButton: Boolean = false,
    onBack: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.fillMaxSize().background(HcColors.Page)) {
        if (title != null) {
            HcAppBar(title, back = back, onBack = onBack, trailing = trailing, icon = icon, leading = leading, profile = profile, settingsButton = settingsButton)
        }
        val body = Modifier.weight(1f).fillMaxWidth()
        Column(
            (if (scroll) body.verticalScroll(rememberScrollState()) else body).padding(contentPadding),

            content = content,
        )
        if (bottom != null) Column(Modifier.fillMaxWidth().padding(HcDimens.Gutter), content = bottom)
    }
}

/** src/components/hf/HfLoader.tsx — centred spinner in the accent colour. */
@Composable
fun HcLoader(modifier: Modifier = Modifier.fillMaxWidth().padding(32.dp)) {
    Box(modifier, contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = HcColors.Brand, trackColor = HcColors.Accent, strokeWidth = 3.dp, modifier = Modifier.size(32.dp))
    }
}

/** Error line under a form (hf-type-caption text-hf-red-dark). */
@Composable
fun HcError(message: String?, modifier: Modifier = Modifier) {
    if (message != null) HcText(message, HcTypeRoles.Caption, modifier, color = HcColors.Danger)
}

/** <Link className="underline"> */
@Composable
fun HcLink(text: String, href: String, modifier: Modifier = Modifier, role: HcTypeRole = HcTypeRoles.Body, align: TextAlign? = null) {
    val nav = LocalNavigator.current
    HcText(text, role, modifier.clickable { nav.push(href) }, underline = true, align = align)
}

/** Images from the web app's public/ folder or API, loaded from the same server. */
@Composable
fun HcRemoteImage(src: String?, modifier: Modifier = Modifier, contentDescription: String? = null, contentScale: androidx.compose.ui.layout.ContentScale = androidx.compose.ui.layout.ContentScale.Fit) {
    AsyncImage(model = Api.absoluteUrl(src), contentDescription = contentDescription, modifier = modifier, contentScale = contentScale)
}

/**
 * useIsCompactLandscape(): a phone turned to landscape (wide AND at most 500
 * px high). The app bar gets lower and the bottom bar folds to a handle.
 */
val LocalCompactLandscape = compositionLocalOf { false }

/** BottomSheet `size`: Auto = the content's height, Half = 50 % of the screen, Full = almost the whole screen. */
enum class HcSheetSize { Auto, Half, Full }

/**
 * web useBottomSheetClose(): closes the surrounding sheet with the slide-out
 * animation, then calls its onDismiss. Buttons inside a sheet ("Spring over",
 * "Luk") use this instead of calling onDismiss directly.
 */
val LocalHcSheetClose = staticCompositionLocalOf<() -> Unit> { {} }

/**
 * src/components/hf/BottomSheet.tsx — draggable bottom sheet with a grab handle.
 *
 * - [title] is only the accessible name: the web shows no visible sheet title
 *   (owner's rule 2026-10-07, .hf-bottom-sheet__title is screen-reader only).
 * - [footer] (.hf-bottom-sheet__footer) stays fixed under the body: 16 px
 *   padding, 8 px between the buttons; the body above it shrinks/scrolls.
 * - [size] Half/Full gives the sheet a fixed height (hf-bottom-sheet--half/--full).
 * - [scrollable] wraps the body in a vertical scroll — only for bodies that do
 *   not scroll themselves (a scrolling child inside would get no height limit).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HcBottomSheet(
    onDismiss: () -> Unit,
    title: String? = null,
    size: HcSheetSize = HcSheetSize.Auto,
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    scrollable: Boolean = false,
    containerColor: Color = HcColors.Page,
    content: @Composable ColumnScope.() -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val latestDismiss by rememberUpdatedState(onDismiss)
    var closing by remember { mutableStateOf(false) }
    val close: () -> Unit = {
        if (!closing) {
            closing = true
            scope.launch { sheetState.hide() }.invokeOnCompletion { latestDismiss() }
        }
    }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = containerColor,
        shape = RoundedCornerShape(topStart = HcDimens.RadiusSheet, topEnd = HcDimens.RadiusSheet),
        scrimColor = HcColors.Overlay,
        // iOS grabber: 36 × 4, 8 above and 16 below (web .hf-bottom-sheet__grab).
        dragHandle = {
            Box(Modifier.padding(top = 8.dp, bottom = 16.dp).size(36.dp, 4.dp).clip(RoundedCornerShape(50)).background(HcColors.Gray))
        },
    ) {
        CompositionLocalProvider(LocalHcSheetClose provides close) {
            val outer = when (size) {
                HcSheetSize.Auto -> Modifier.fillMaxWidth()
                HcSheetSize.Half -> Modifier.fillMaxWidth().fillMaxHeight(0.5f)
                HcSheetSize.Full -> Modifier.fillMaxWidth().fillMaxHeight()
            }
            Column(outer.semantics { if (title != null) contentDescription = title }) {
                val body = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = size != HcSheetSize.Auto)
                    .let { if (scrollable) it.verticalScroll(rememberScrollState()) else it }
                    .padding(horizontal = HcDimens.Gutter)
                    .padding(bottom = if (footer == null) HcDimens.SpaceSection else 0.dp)
                Column(body, content = content)
                if (footer != null) {
                    Column(
                        Modifier.fillMaxWidth().navigationBarsPadding().padding(HcDimens.SpaceBlock),
                        verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline),
                        content = footer,
                    )
                }
            }
        }
    }
}

/** web BottomSheetCloseButton with className="hf-bottom-sheet__skip": text button that closes the sheet ([onClick] runs first). */
@Composable
fun HcSheetSkipButton(label: String, onClick: (() -> Unit)? = null) {
    val close = LocalHcSheetClose.current
    Box(
        Modifier.fillMaxWidth().height(HcDimens.ControlHeight).clickable {
            onClick?.invoke()
            close()
        },
        contentAlignment = Alignment.Center,
    ) {
        HcText(label, HcTypeRoles.Button, color = HcColors.Text, align = TextAlign.Center)
    }
}

/** web BottomSheetDots — page dots for steps/slides in a sheet (active = brand green). */
@Composable
fun HcSheetDots(count: Int, active: Int, onSelect: ((Int) -> Unit)? = null) {
    Row(horizontalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline), verticalAlignment = Alignment.CenterVertically) {
        repeat(count) { index ->
            Box(
                Modifier.size(8.dp).clip(CircleShape).background(if (index == active) HcColors.Brand else HcColors.Gray)
                    .let { if (onSelect != null) it.clickable { onSelect(index) } else it },
            )
        }
    }
}

/** A row in a settings-style list: label, optional value, chevron. */
@Composable
fun HcListRow(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, value: String? = null, icon: String? = null) {
    Row(
        modifier.fillMaxWidth().heightIn(min = 56.dp).clickable(onClick = onClick).padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (icon != null) HcIcon(icon, size = 24.dp, stroke = 1.6f)
        HcText(label, HcTypeRoles.BodyLg, Modifier.weight(1f))
        if (value != null) HcText(value, HcTypeRoles.Body, color = HcColors.TextSecondary)
        HcIcon("ChevronRight", size = 20.dp, color = HcColors.Inactive)
    }
}

@Composable
fun HcDivider() = HorizontalDivider(thickness = 1.dp, color = HcColors.Nav)

@Composable
fun VSpace(height: Dp) = Spacer(Modifier.height(height))

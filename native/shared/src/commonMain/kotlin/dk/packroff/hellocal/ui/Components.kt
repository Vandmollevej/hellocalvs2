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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
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
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRole
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.icons.HcIcon

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
 * .hf-appbar — green bar with centred white title and 44 px slots each side.
 * `back = true` shows the back chevron that pops the native stack.
 */
@Composable
fun HcAppBar(
    title: String,
    back: Boolean = true,
    onBack: (() -> Unit)? = null,
    trailing: (@Composable RowScope.() -> Unit)? = null,
    background: Color = HcColors.Brand,
) {
    val nav = LocalNavigator.current
    Row(
        Modifier
            .fillMaxWidth()
            .background(background)
            .statusBarsPadding()
            .height(52.dp)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(44.dp), contentAlignment = Alignment.CenterStart) {
            if (back) {
                Box(Modifier.size(44.dp).clickable { (onBack ?: { nav.back() })() }, contentAlignment = Alignment.CenterStart) {
                    HcIcon("ChevronLeft", color = HcColors.White, size = 28.dp)
                }
            }
        }
        HcText(title, HcTypeRoles.NavTitle, Modifier.weight(1f), align = TextAlign.Center, maxLines = 1)
        Row(Modifier.width(44.dp), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
            trailing?.invoke(this)
        }
    }
}

/** A screen: app bar on top, scrolling content in the page colour. */
@Composable
fun HcScreen(
    title: String?,
    back: Boolean = true,
    trailing: (@Composable RowScope.() -> Unit)? = null,
    bottom: (@Composable ColumnScope.() -> Unit)? = null,
    scroll: Boolean = true,
    contentPadding: PaddingValues = PaddingValues(HcDimens.Gutter),
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.fillMaxSize().background(HcColors.Page)) {
        if (title != null) HcAppBar(title, back = back, trailing = trailing)
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

/** src/components/hf/BottomSheet.tsx — draggable bottom sheet with a grab handle. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HcBottomSheet(onDismiss: () -> Unit, title: String? = null, content: @Composable ColumnScope.() -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = HcColors.Page,
        shape = RoundedCornerShape(topStart = HcDimens.RadiusSheet, topEnd = HcDimens.RadiusSheet),
        scrimColor = HcColors.Overlay,
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = HcDimens.Gutter).padding(bottom = HcDimens.SpaceSection)) {
            if (title != null) {
                HcText(title, HcTypeRoles.Title, Modifier.fillMaxWidth(), align = TextAlign.Center)
                Spacer(Modifier.height(HcDimens.SpaceBlock))
            }
            content()
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

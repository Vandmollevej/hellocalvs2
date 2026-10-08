package dk.packroff.hellocal.theme

import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.sp

/**
 * The web design (src/app/globals.css) as a Compose theme. Every value comes
 * from the generated HcTokens.kt — never write a colour or size here directly;
 * change the web token and run `node scripts/native/sync.mjs`.
 *
 * Fonts: the web uses the system font (SF Pro on iPhone); FontFamily.Default is
 * the same on iPhone and Roboto on Android, matching the web fallback.
 */
fun HcTypeRole.style(color: Color? = null): TextStyle = TextStyle(
    fontFamily = FontFamily.Default,
    fontSize = size.sp,
    fontWeight = weight,
    lineHeight = lineHeight?.sp ?: androidx.compose.ui.unit.TextUnit.Unspecified,
    color = color ?: this.color ?: HcColors.Text,
)

private val colorScheme = lightColorScheme(
    primary = HcColors.Brand,
    onPrimary = HcColors.White,
    secondary = HcColors.Action,
    onSecondary = HcColors.White,
    tertiary = HcColors.Accent,
    onTertiary = HcColors.Action,
    background = HcColors.Page,
    onBackground = HcColors.Text,
    surface = HcColors.Page,
    onSurface = HcColors.Text,
    surfaceVariant = HcColors.Card,
    onSurfaceVariant = HcColors.TextSecondary,
    outline = HcColors.Line,
    outlineVariant = HcColors.Nav,
    error = HcColors.Danger,
    onError = HcColors.White,
    scrim = HcColors.Overlay,
)

private val typography = androidx.compose.material3.Typography(
    displayLarge = HcTypeRoles.Hero.style(),
    headlineMedium = HcTypeRoles.PageTitle.style(),
    titleLarge = HcTypeRoles.PageTitle.style(),
    titleMedium = HcTypeRoles.Title.style(),
    titleSmall = HcTypeRoles.SectionTitle.style(),
    bodyLarge = HcTypeRoles.BodyLg.style(),
    bodyMedium = HcTypeRoles.Body.style(),
    bodySmall = HcTypeRoles.Small.style(),
    labelLarge = HcTypeRoles.Button.style(),
    labelMedium = HcTypeRoles.Label.style(),
    labelSmall = HcTypeRoles.Micro.style(),
)

@Composable
fun HelloCalTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colorScheme, typography = typography) {
        CompositionLocalProvider(
            androidx.compose.foundation.text.selection.LocalTextSelectionColors provides
                TextSelectionColors(handleColor = HcColors.Brand, backgroundColor = HcColors.Accent),
            content = content,
        )
    }
}

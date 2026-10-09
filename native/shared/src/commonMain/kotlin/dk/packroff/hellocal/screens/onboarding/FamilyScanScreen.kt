package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.CancellationException

/**
 * Native port of src/app/family-code/scan/page.tsx — scan the family QR code
 * and continue on the family-code or join page. The camera is the platform's
 * QR scanner (OnboardingHooks.scanQrCode); tapping the square scans again.
 */
@Composable
fun FamilyScanScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var error by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableIntStateOf(0) }
    var scanning by remember { mutableStateOf(false) }

    LaunchedEffect(attempt) {
        val scanner = OnboardingHooks.scanQrCode
        if (scanner == null) {
            error = t.t("family.scan.noCamera")
            return@LaunchedEffect
        }
        scanning = true
        try {
            val text = scanner()
            if (text != null) {
                val path = familyPathFromQr(text)
                if (path == null) {
                    error = t.t("family.scan.notFamilyCode")
                } else {
                    nav.replace(path)
                }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            error = t.t("family.scan.noCamera")
        } finally {
            scanning = false
        }
    }

    HcScreen(title = t.t("family.scan.title"), contentPadding = FamilyPagePadding) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            HcText(t.t("family.scan.intro"), HcTypeRoles.Body)
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Box(
                    Modifier.widthIn(max = 360.dp).fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(HcDimens.RadiusCard))
                        .background(HcColors.Black)
                        .clickable(enabled = !scanning && OnboardingHooks.scanQrCode != null) {
                            error = null
                            attempt++
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    if (scanning) HcLoader() else HcIcon("Camera", size = 48.dp, color = HcColors.White, stroke = 1.6f)
                }
            }
            error?.let { HcText(it, HcTypeRoles.Body, color = HcColors.Danger) }
            HcButton(t.t("family.scan.typeInstead"), onClick = { nav.push("/family-code") }, kind = HcButtonKind.Secondary)
        }
    }
}

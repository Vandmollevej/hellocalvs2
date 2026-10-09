package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.OnbFaceIdAnimation
import dk.packroff.hellocal.ui.OnbFaceIdPhase
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/**
 * Native port of src/app/login/face-id/page.tsx — offer after login: turn on
 * Face ID (passkey) so the next login only needs the face.
 * The passkey itself is created by the platform via OnboardingHooks.registerPasskey.
 */
@Composable
fun FaceIdOfferScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val next = safeNext(args.opt("next"))
    var ready by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var phase by remember { mutableStateOf(OnbFaceIdPhase.Idle) }

    // Only for logged-in users, and only when this device doesn't have Face ID yet.
    LaunchedEffect(Unit) {
        if (OnboardingHooks.hasPasskeyOnDevice()) {
            nav.replace(next)
            return@LaunchedEffect
        }
        try {
            Api.get("/api/auth/me")
            ready = true
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            nav.replace(next)
        }
    }

    fun enable() {
        busy = true
        error = null
        phase = OnbFaceIdPhase.Scanning
        scope.launch {
            try {
                val register = OnboardingHooks.registerPasskey ?: throw IllegalStateException("Passkeys are not available on this device")
                register()
                phase = OnbFaceIdPhase.Success // continues when the animation is done
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                phase = OnbFaceIdPhase.Failed
                error = t.t("faceIdOffer.error")
                busy = false
            }
        }
    }

    fun skip() {
        markFaceIdDeclined()
        nav.replace(next)
    }

    if (!ready) return

    Column(Modifier.fillMaxSize().background(HcColors.Cream)) {
        HcAppBar(t.t("faceIdOffer.title"), back = false)
        Column(
            Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp).padding(top = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(Modifier.fillMaxWidth().padding(vertical = 16.dp), contentAlignment = Alignment.Center) {
                OnbFaceIdAnimation(phase, size = 112.dp, onDone = { nav.replace(next) })
            }
            HcText(t.t("faceIdOffer.intro"), HcTypeRoles.Body)
            HcError(error)
        }
        Column(
            Modifier.fillMaxWidth().padding(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection),
            verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock),
        ) {
            HcButton(if (busy) t.t("faceIdOffer.enabling") else t.t("faceIdOffer.enable"), onClick = ::enable, enabled = !busy)
            HcButton(t.t("faceIdOffer.skip"), onClick = ::skip, kind = HcButtonKind.Text, enabled = !busy)
        }
    }
}

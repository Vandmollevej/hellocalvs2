package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcText

private enum class VerifyState { Checking, Ok, Invalid }

/** Native port of src/app/verify-email/page.tsx (link from the confirmation e-mail, ?token=…). */
@Composable
fun VerifyEmailScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val token = args.opt("token") ?: ""
    var state by remember { mutableStateOf(if (token.isNotEmpty()) VerifyState.Checking else VerifyState.Invalid) }

    LaunchedEffect(token) {
        if (token.isEmpty()) return@LaunchedEffect
        state = try {
            Api.post("/api/auth/verify-email", mapOf("token" to token))
            // The banner/sheet for unverified e-mail reads emailVerified from /api/auth/me.
            if (Session.state == Session.State.LoggedIn) Session.refresh()
            VerifyState.Ok
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            VerifyState.Invalid
        }
    }

    Column(Modifier.fillMaxSize().background(HcColors.Cream)) {
        HcAppBar(t.t("verifyEmail.title"), back = false)
        Column(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp).padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            when (state) {
                VerifyState.Checking -> HcText(t.t("verifyEmail.checking"), HcTypeRoles.Body)
                VerifyState.Ok -> HcText(t.t("verifyEmail.success"), HcTypeRoles.Body)
                VerifyState.Invalid -> HcError(t.t("verifyEmail.invalid"))
            }
            Spacer(Modifier.weight(1f))
            if (state != VerifyState.Checking) {
                HcButton(t.t("verifyEmail.continue"), onClick = { nav.resetTo("/") }, modifier = Modifier.padding(bottom = 32.dp))
            }
        }
    }
}

package dk.packroff.hellocal.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.LoginResult
import dk.packroff.hellocal.api.NativeAuth
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.screens.onboarding.readLoginCountry
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcLink
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.VSpace
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Native port of src/app/login/page.tsx. */
@Composable
fun LoginScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var error by remember(args.opt("error")) { mutableStateOf(oauthErrorMessage(args.opt("error"), t)) }
    var approval by remember { mutableStateOf<Pair<String, String>?>(null) }

    fun submit() {
        error = null
        submitting = true
        scope.launch {
            when (val result = Session.login(email.trim(), password)) {
                LoginResult.Success -> nav.resetTo(args.opt("next") ?: "/")
                is LoginResult.ApprovalRequired -> {
                    val id = result.data["approvalId"]?.jsonPrimitive?.contentOrNull
                    val secret = result.data["secret"]?.jsonPrimitive?.contentOrNull
                    if (id != null && secret != null) approval = id to secret else submitting = false
                }
                is LoginResult.Failed -> {
                    error = result.message.ifBlank { t.t("login.genericError") }
                    submitting = false
                }
            }
        }
    }

    // Asks every other second whether the login was approved on the other device.
    LaunchedEffect(approval) {
        val pending = approval ?: return@LaunchedEffect
        while (true) {
            delay(2000)
            val status = runCatching {
                Api.post("/api/auth/login-approval/status", mapOf("approvalId" to pending.first, "secret" to pending.second))
                    .jsonObject["status"]?.jsonPrimitive?.contentOrNull
            }.getOrNull()
            when (status) {
                "approved" -> {
                    Session.completedExternally()
                    nav.resetTo(args.opt("next") ?: "/")
                    return@LaunchedEffect
                }
                "denied", "expired" -> {
                    approval = null
                    submitting = false
                    error = t.t(if (status == "denied") "loginApproval.denied" else "loginApproval.expired")
                    return@LaunchedEffect
                }
            }
        }
    }

    Column(Modifier.fillMaxSize().background(HcColors.Cream)) {
        Box(
            Modifier.fillMaxWidth().background(HcColors.Brand).statusBarsPadding().padding(horizontal = 16.dp).padding(bottom = 16.dp, top = 16.dp),
            contentAlignment = Alignment.Center,
        ) {
            HcText("${t.t("welcome.signUp")} / ${t.t("welcome.logIn")}", HcTypeRoles.NavTitle, align = TextAlign.Center)
        }

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(top = 16.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                HcText(t.t("login.chooseCountry"), HcTypeRoles.Body, Modifier.weight(1f))
                // The country chosen on /login/country (stored on the device), Denmark by default.
                val country = remember(nav.current) { readLoginCountry() }
                Row(
                    Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(50)).border(1.dp, HcColors.GrayBorder, RoundedCornerShape(50))
                        .clickable { nav.push("/login/country") }.padding(horizontal = 12.dp)
                        .semantics { contentDescription = t.t("country.countries.${country.key}") },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    HcRemoteImage("/flags/${country.flag}.png", Modifier.width(22.dp).height(16.dp).clip(RoundedCornerShape(2.dp)))
                    HcText(country.code, HcTypeRoles.Body, bold = true)
                }
            }

            VSpace(32.dp)
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                val oauthNext = args.opt("next") ?: "/"
                SocialLoginButton("google", t.t("login.continueWithGoogle"), HcColors.Google, oauthNext)
                SocialLoginButton("apple", t.t("login.continueWithApple"), HcColors.Action, oauthNext)
                SocialLoginButton("facebook", t.t("login.continueWithFacebook"), HcColors.Facebook, oauthNext)
            }
            VSpace(16.dp)
            HcText(t.t("common.or"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            VSpace(8.dp)
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcTextField(email, { email = it }, placeholder = t.t("login.emailPlaceholder"), keyboardType = KeyboardType.Email)
                HcTextField(password, { password = it }, placeholder = t.t("login.passwordPlaceholder"), password = true)
            }
            VSpace(8.dp)
            HcLink(t.t("login.forgotPassword"), "/forgot-password", Modifier.fillMaxWidth(), align = TextAlign.End)
            HcError(error, Modifier.padding(top = 8.dp))
            VSpace(16.dp)
            HcLink(t.t("login.haveFamilyCode"), "/family-code", Modifier.fillMaxWidth(), align = TextAlign.Center)
        }

        Column(Modifier.padding(horizontal = 16.dp).padding(top = 16.dp, bottom = 24.dp)) {
            HcButton(
                if (submitting) t.t("login.submitting") else t.t("login.continueButton"),
                onClick = ::submit,
                enabled = !submitting && email.isNotBlank() && password.isNotEmpty(),
            )
            VSpace(20.dp)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                HcText("${t.t("login.newHere")} ", HcTypeRoles.BodyLg)
                HcLink(t.t("login.createAccount"), "/signup", role = HcTypeRoles.BodyLg)
            }
        }
    }

    if (approval != null) {
        HcBottomSheet(onDismiss = { approval = null; submitting = false }) {
            HcText(t.t("loginApproval.waitingBody"), HcTypeRoles.Body)
            VSpace(16.dp)
            HcButton(t.t("loginApproval.waitingCancel"), onClick = { approval = null; submitting = false }, kind = HcButtonKind.Secondary)
        }
    }
}

private const val ACCOUNT_BLOCKED_MESSAGE =
    "Din konto er spærret, fordi der igen blev forsøgt oprettet dyrefoder. Du har ikke længere adgang. Kontakt support, hvis du mener, det er en fejl."

/** web oauthErrorKey() (src/lib/login-flow.ts): ?error=… from the OAuth hand-off → message. */
private fun oauthErrorMessage(code: String?, t: Translator): String? {
    if (code == null || code == "oauth-cancelled") return null
    // src/lib/pet-food-messages.ts ACCOUNT_BLOCKED_MESSAGE (not an i18n key on the web either).
    if (code == "account-blocked") return ACCOUNT_BLOCKED_MESSAGE
    val notConfigured = Regex("^(google|apple|facebook)-not-configured$").find(code)
    if (notConfigured != null) {
        val provider = when (notConfigured.groupValues[1]) {
            "google" -> "Google"
            "apple" -> "Apple"
            else -> "Facebook"
        }
        return t.t("login.errorNotConfigured", "provider" to provider)
    }
    if (code == "oauth-expired") return t.t("login.errorOauthExpired")
    return t.t("login.errorOauth")
}

/**
 * src/components/hf/SocialLoginButton.tsx. Apple/Google/Facebook login runs in
 * the system browser (Google blocks embedded web views) and returns to the app
 * via hellocal://auth/complete?code=… (api/NativeAuth.kt, app/HelloCalApp.kt).
 */
@Composable
private fun SocialLoginButton(provider: String, label: String, background: Color, next: String) {
    Row(
        Modifier.fillMaxWidth().height(HcDimens.ControlHeight).clip(RoundedCornerShape(HcDimens.RadiusCard)).background(background)
            .clickable { NativeHooks.openExternalUrl(NativeAuth.oauthStartUrl(provider, next)) },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(47.dp), contentAlignment = Alignment.Center) { HcRemoteImage("/icon-$provider.png", Modifier.size(20.dp)) }
        HcText(label, HcTypeRoles.Button, Modifier.weight(1f), color = HcColors.White, align = TextAlign.Center)
        Box(Modifier.width(47.dp))
    }
}

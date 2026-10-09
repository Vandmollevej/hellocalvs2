package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcLink
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.OnbRichText
import dk.packroff.hellocal.ui.OnbSocialLoginButton
import dk.packroff.hellocal.ui.VSpace
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Native port of src/app/signup/page.tsx (account + 6-digit SMS code, DECISIONS 2026-10-02). */
@Composable
fun SignupScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val referralCode = args.opt("ref")
    // E.g. the front page's payment sheet: straight to the subscription page after sign-up.
    val next = args.opt("next") ?: "/"

    var displayName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var healthDataConsent by remember { mutableStateOf(false) }
    var phone by remember { mutableStateOf("") }
    // Step 2: 6-digit SMS code.
    var verificationId by remember { mutableStateOf<String?>(null) }
    var normalizedPhone by remember { mutableStateOf("") }
    var smsCode by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var submitting by remember { mutableStateOf(false) }

    /** POST /api/auth/sms/signup → { verificationId, phone }. Network errors are thrown to the caller. */
    suspend fun sendCode(): Boolean = try {
        val data = Api.post("/api/auth/sms/signup", mapOf("email" to email, "phone" to phone)).jsonObject
        verificationId = data["verificationId"]?.jsonPrimitive?.contentOrNull
        normalizedPhone = data["phone"]?.jsonPrimitive?.contentOrNull ?: ""
        smsCode = ""
        true
    } catch (e: ApiException) {
        error = e.serverMessage() ?: t.t("signup.genericError")
        false
    }

    fun handleResend() {
        error = null
        submitting = true
        scope.launch {
            try {
                sendCode()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = t.t("sms.networkError")
            }
            submitting = false
        }
    }

    fun handleSubmit() {
        error = null
        if (!healthDataConsent) {
            error = t.t("signup.consentRequired")
            return
        }
        submitting = true
        scope.launch {
            try {
                val id = verificationId
                if (id == null) {
                    sendCode()
                    submitting = false
                    return@launch
                }
                val body = buildMap<String, Any?> {
                    put("displayName", displayName)
                    put("email", email)
                    put("password", password)
                    if (referralCode != null) put("referralCode", referralCode)
                    put("healthDataConsent", healthDataConsent)
                    put("phone", normalizedPhone)
                    put("verificationId", id)
                    put("smsCode", smsCode)
                }
                Api.post("/api/auth/register", body)
                Session.completedExternally()
                nav.resetTo(afterLoginPath(next))
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                error = e.serverMessage() ?: t.t("signup.genericError")
                submitting = false
            } catch (e: Exception) {
                error = t.t("signup.networkError")
                submitting = false
            }
        }
    }

    // Browser form validation on the web (required, type=email, minLength=8, pattern=[0-9]{6}).
    val formValid = if (verificationId != null) {
        smsCode.length == 6
    } else {
        displayName.isNotBlank() && email.contains('@') && phone.isNotBlank() && password.length >= 8
    }

    Column(Modifier.fillMaxSize().background(HcColors.Cream)) {
        HcAppBar(t.t("signup.title"), onBack = { nav.backTo("/welcome") })

        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(top = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (verificationId != null) {
                HcText(t.t("sms.codeSent", "phone" to normalizedPhone), HcTypeRoles.Body)
                HcTextField(
                    smsCode,
                    { smsCode = it.filter(Char::isDigit).take(6) },
                    label = t.t("sms.codeLabel"),
                    placeholder = t.t("sms.codePlaceholder"),
                    keyboardType = KeyboardType.Number,
                )
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    HcText(
                        t.t("sms.resend"),
                        HcTypeRoles.Body,
                        Modifier.clickable(enabled = !submitting) { handleResend() },
                        underline = true,
                    )
                    HcText(
                        t.t("sms.changeNumber"),
                        HcTypeRoles.Body,
                        Modifier.clickable {
                            verificationId = null
                            smsCode = ""
                            error = null
                        },
                        underline = true,
                    )
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    OnbSocialLoginButton("google", t.t("login.continueWithGoogle"), onClick = { startOAuth("google", next) })
                    OnbSocialLoginButton("apple", t.t("login.continueWithApple"), onClick = { startOAuth("apple", next) })
                    OnbSocialLoginButton("facebook", t.t("login.continueWithFacebook"), onClick = { startOAuth("facebook", next) })
                }
                HcText(t.t("common.or"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)

                HcTextField(displayName, { displayName = it }, label = t.t("signup.nameLabel"), placeholder = t.t("signup.namePlaceholder"))
                HcTextField(email, { email = it }, label = t.t("signup.emailLabel"), keyboardType = KeyboardType.Email)
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcTextField(
                        phone,
                        { phone = it },
                        label = t.t("sms.phoneLabel"),
                        placeholder = t.t("sms.phonePlaceholder"),
                        keyboardType = KeyboardType.Phone,
                    )
                    HcText(t.t("sms.phoneHint"), HcTypeRoles.Caption, color = HcColors.TextSecondary)
                }
                HcTextField(
                    password,
                    { password = it },
                    label = t.t("signup.passwordLabel"),
                    placeholder = t.t("signup.passwordPlaceholder"),
                    password = true,
                )
                HcLink(t.t("login.forgotPassword"), "/forgot-password", Modifier.fillMaxWidth(), align = TextAlign.End)

                HealthConsentToggle(healthDataConsent) { healthDataConsent = it }
            }

            HcError(error)

            VSpace(8.dp)
            HcButton(
                when {
                    verificationId != null && submitting -> t.t("sms.signupConfirming")
                    verificationId != null -> t.t("sms.signupConfirm")
                    submitting -> t.t("sms.sendingCode")
                    else -> t.t("sms.sendCode")
                },
                onClick = ::handleSubmit,
                enabled = !submitting && formValid,
            )
            Row(Modifier.fillMaxWidth().padding(bottom = 24.dp), horizontalArrangement = Arrangement.Center) {
                HcText("${t.t("signup.haveAccount")} ", HcTypeRoles.BodyLg)
                HcLink(
                    t.t("signup.logIn"),
                    if (next == "/") "/login" else "/login?next=" + Location.encode(next),
                    role = HcTypeRoles.BodyLg,
                )
            }

            // Member of a family account: invitation code + e-mail or QR code (DECISIONS 2026-10-03).
            if (verificationId == null) {
                Column(Modifier.padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    HcSectionTitle(t.t("signup.family.title"))
                    HcText(t.t("signup.family.intro"), HcTypeRoles.Body)
                    HcButton(t.t("signup.family.enterCode"), onClick = { nav.push("/family-code") }, kind = HcButtonKind.Secondary)
                    HcButton(t.t("signup.family.scan"), onClick = { nav.push("/family-code/scan") }, kind = HcButtonKind.Secondary)
                }
            }
        }
    }
}

/** src/components/hf/HealthConsentToggle.tsx — explicit GDPR art. 9 consent with link to the terms. */
@Composable
private fun HealthConsentToggle(checked: Boolean, onChange: (Boolean) -> Unit) {
    val t = LocalTranslator.current
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OnbRichText(
            "${t.t("signup.healthConsent")} {${t.t("signup.healthConsentTermsLink")}|/betingelser}.",
            HcTypeRoles.Caption,
            Modifier.weight(1f),
        )
        Box(Modifier.padding(top = 2.dp)) { HcToggle(checked, onChange) }
    }
}

package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcLink
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Native port of src/app/reset-password/page.tsx (?token=…, optional SMS code if the account has a phone). */
@Composable
fun ResetPasswordScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val token = args.opt("token") ?: ""
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var submitting by remember { mutableStateOf(false) }
    // SMS code as an extra check when the account has a confirmed mobile number (DECISIONS 2026-10-02).
    var maskedPhone by remember { mutableStateOf<String?>(null) }
    var verificationId by remember { mutableStateOf<String?>(null) }
    var smsCode by remember { mutableStateOf("") }

    LaunchedEffect(token) {
        if (token.isEmpty()) return@LaunchedEffect
        runCatching {
            val data = Api.post("/api/auth/reset-password/sms", mapOf("token" to token, "action" to "status")).jsonObject
            if (data["requiresSms"]?.jsonPrimitive?.booleanOrNull == true) maskedPhone = data["phone"]?.jsonPrimitive?.contentOrNull
        }
    }

    fun sendCode() {
        error = null
        submitting = true
        scope.launch {
            try {
                val data = Api.post("/api/auth/reset-password/sms", mapOf("token" to token, "action" to "send")).jsonObject
                verificationId = data["verificationId"]?.jsonPrimitive?.contentOrNull
                smsCode = ""
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                error = e.serverMessage() ?: t.t("resetPassword.genericError")
            } catch (e: Exception) {
                error = t.t("sms.networkError")
            }
            submitting = false
        }
    }

    fun handleSubmit() {
        error = null
        if (password.length < 8) {
            error = t.t("resetPassword.tooShortError")
            return
        }
        if (password != confirmPassword) {
            error = t.t("resetPassword.mismatchError")
            return
        }
        submitting = true
        scope.launch {
            try {
                val data = Api.post(
                    "/api/auth/reset-password",
                    mapOf("token" to token, "password" to password, "verificationId" to verificationId, "smsCode" to smsCode),
                ).jsonObject
                // An admin continues to the admin login (2FA) on the admin host, not to the app.
                if (data["isAdmin"]?.jsonPrimitive?.booleanOrNull == true) {
                    NativeHooks.openExternalUrl("https://admin.hellocal.io/admin/login")
                    submitting = false
                } else {
                    Session.completedExternally()
                    nav.resetTo("/")
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                error = e.serverMessage() ?: t.t("resetPassword.genericError")
                submitting = false
            } catch (e: Exception) {
                error = t.t("resetPassword.networkError")
                submitting = false
            }
        }
    }

    Column(Modifier.fillMaxSize().background(HcColors.Cream)) {
        HcAppBar(t.t("resetPassword.title"), onBack = { nav.backTo("/login") })
        val body = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(top = 32.dp)

        when {
            token.isEmpty() -> Column(body, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcError(t.t("resetPassword.missingToken"))
                HcLink(t.t("resetPassword.requestNewLink"), "/forgot-password")
            }
            maskedPhone != null && verificationId == null -> {
                Column(body, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    HcText(t.t("sms.resetRequired", "phone" to (maskedPhone ?: "")), HcTypeRoles.Body)
                    HcError(error)
                }
                BottomButton(if (submitting) t.t("sms.sendingCode") else t.t("sms.sendCode"), enabled = !submitting, onClick = ::sendCode)
            }
            else -> {
                Column(body, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    if (verificationId != null) {
                        HcText(t.t("sms.codeSent", "phone" to (maskedPhone ?: "")), HcTypeRoles.Body)
                        HcTextField(
                            smsCode,
                            { smsCode = it.filter(Char::isDigit).take(6) },
                            label = t.t("sms.codeLabel"),
                            placeholder = t.t("sms.codePlaceholder"),
                            keyboardType = KeyboardType.Number,
                        )
                        HcText(
                            t.t("sms.resend"),
                            HcTypeRoles.Body,
                            Modifier.clickable(enabled = !submitting) { sendCode() },
                            underline = true,
                        )
                    }
                    HcTextField(
                        password,
                        { password = it },
                        label = t.t("resetPassword.newPasswordLabel"),
                        placeholder = t.t("signup.passwordPlaceholder"),
                        password = true,
                    )
                    HcTextField(confirmPassword, { confirmPassword = it }, label = t.t("resetPassword.confirmPasswordLabel"), password = true)
                    HcError(error)
                }
                BottomButton(
                    if (submitting) t.t("resetPassword.submitting") else t.t("resetPassword.submit"),
                    enabled = !submitting,
                    onClick = ::handleSubmit,
                )
            }
        }
    }
}

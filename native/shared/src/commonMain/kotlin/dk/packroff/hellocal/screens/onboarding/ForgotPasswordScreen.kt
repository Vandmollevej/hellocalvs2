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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private enum class ResetMethod { Email, Sms }

/** Native port of src/app/forgot-password/page.tsx (reset link by e-mail or 6-digit SMS code). */
@Composable
fun ForgotPasswordScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var method by remember { mutableStateOf(ResetMethod.Email) }
    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var sent by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun switchMethod(next: ResetMethod) {
        method = next
        sent = false
        code = ""
        error = null
    }

    fun handleSubmit() {
        error = null
        submitting = true
        scope.launch {
            try {
                val url = if (method == ResetMethod.Sms) "/api/auth/forgot-password/sms" else "/api/auth/forgot-password"
                Api.post(url, mapOf("email" to email))
                sent = true
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                error = e.serverMessage() ?: t.t("forgotPassword.genericError")
            } catch (e: Exception) {
                error = t.t("forgotPassword.networkError")
            }
            submitting = false
        }
    }

    // A correct SMS code gives an ordinary reset token → same page as the e-mail link.
    fun handleVerify() {
        error = null
        submitting = true
        scope.launch {
            try {
                val data = Api.post("/api/auth/forgot-password/sms/verify", mapOf("email" to email, "code" to code)).jsonObject
                val token = data["token"]?.jsonPrimitive?.takeIf { it.isString }?.contentOrNull
                if (token == null) {
                    error = t.t("forgotPassword.genericError")
                    submitting = false
                    return@launch
                }
                nav.push("/reset-password?token=" + Location.encode(token))
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                error = e.serverMessage() ?: t.t("forgotPassword.genericError")
                submitting = false
            } catch (e: Exception) {
                error = t.t("forgotPassword.networkError")
                submitting = false
            }
        }
    }

    Column(Modifier.fillMaxSize().background(HcColors.Cream)) {
        HcAppBar(t.t("forgotPassword.title"), onBack = { nav.backTo("/login") })

        val body = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(top = 32.dp)
        when {
            sent && method == ResetMethod.Email -> {
                Column(body, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    HcText(t.t("forgotPassword.sentMessage"), HcTypeRoles.Body)
                    HcButton(t.t("forgotPassword.backToLogin"), onClick = { nav.backTo("/login") }, modifier = Modifier.padding(top = 8.dp))
                }
            }
            sent && method == ResetMethod.Sms -> {
                Column(body, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    HcText(t.t("forgotPassword.smsSentMessage"), HcTypeRoles.Body)
                    HcTextField(
                        code,
                        { code = it.filter(Char::isDigit).take(6) },
                        label = t.t("forgotPassword.codeLabel"),
                        keyboardType = KeyboardType.Number,
                    )
                    HcError(error)
                    HcText(
                        t.t("forgotPassword.resendCode"),
                        HcTypeRoles.Body,
                        Modifier.align(Alignment.CenterHorizontally).clickable { switchMethod(ResetMethod.Sms) },
                        underline = true,
                    )
                }
                BottomButton(
                    if (submitting) t.t("forgotPassword.verifying") else t.t("forgotPassword.verifySubmit"),
                    enabled = !submitting && code.length == 6,
                    onClick = ::handleVerify,
                )
            }
            else -> {
                Column(body, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    HcText(
                        if (method == ResetMethod.Sms) t.t("forgotPassword.smsInstructions") else t.t("forgotPassword.instructions"),
                        HcTypeRoles.Body,
                    )
                    HcTextField(
                        email,
                        { email = it },
                        label = t.t("forgotPassword.emailLabel"),
                        placeholder = t.t("login.emailPlaceholder"),
                        keyboardType = KeyboardType.Email,
                    )
                    HcError(error)
                    HcText(
                        if (method == ResetMethod.Email) t.t("forgotPassword.useSms") else t.t("forgotPassword.useEmail"),
                        HcTypeRoles.Body,
                        Modifier.align(Alignment.CenterHorizontally)
                            .clickable { switchMethod(if (method == ResetMethod.Email) ResetMethod.Sms else ResetMethod.Email) },
                        underline = true,
                    )
                }
                BottomButton(
                    when {
                        submitting -> t.t("forgotPassword.submitting")
                        method == ResetMethod.Sms -> t.t("forgotPassword.smsSubmit")
                        else -> t.t("forgotPassword.submit")
                    },
                    enabled = !submitting && email.isNotEmpty(),
                    onClick = ::handleSubmit,
                )
            }
        }
    }
}

/** The form's primary button pinned at the bottom (web: flex-1 spacer + "mb-8" button). */
@Composable
internal fun BottomButton(label: String, enabled: Boolean, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 16.dp, bottom = 32.dp)) {
        HcButton(label, onClick = onClick, enabled = enabled)
    }
}

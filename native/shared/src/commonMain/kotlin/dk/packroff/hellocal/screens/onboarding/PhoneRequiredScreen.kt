package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
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
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Native port of src/app/account/phone/page.tsx — mandatory phone number
 * (DECISIONS 2026-10-02) for logged-in users without one. No back arrow and
 * no "skip": the number is used for two-factor approval.
 */
@Composable
fun PhoneRequiredScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val next = safeNext(args.opt("next"))
    var ready by remember { mutableStateOf(false) }
    var region by remember { mutableStateOf("DK") }
    var phone by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var submitting by remember { mutableStateOf(false) }

    // Only for logged-in users; if the account already has a number there is nothing to do.
    LaunchedEffect(Unit) {
        try {
            val user = Api.get("/api/auth/me").jsonObject["user"] as? JsonObject
            if (user?.get("hasPhone")?.jsonPrimitive?.booleanOrNull == true) {
                nav.replace(next)
                return@LaunchedEffect
            }
            ready = true
        } catch (e: CancellationException) {
            throw e
        } catch (e: ApiException) {
            nav.replace("/welcome")
            return@LaunchedEffect
        } catch (e: Exception) {
            ready = true
        }
        runCatching {
            val profileUser = Api.get("/api/profile").jsonObject["user"] as? JsonObject
            profileUser?.get("region")?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotEmpty() }?.let { region = it }
        }
    }

    fun handleSubmit() {
        error = null
        val parsed = validatePhone(phone, region)
        if (parsed is PhoneValidation.Invalid) {
            error = t.t(if (parsed.reason == "empty") "phoneRequired.empty" else "phoneRequired.invalid")
            return
        }
        val e164 = (parsed as PhoneValidation.Ok).e164
        submitting = true
        scope.launch {
            try {
                Api.patch("/api/profile", mapOf("phone" to e164))
                // AuthGate reads hasPhone/phoneRequired from /api/auth/me.
                Session.refresh()
                nav.replace(next)
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                error = t.t(if (e.status == 400) "phoneRequired.invalid" else "phoneRequired.networkError")
                submitting = false
            } catch (e: Exception) {
                error = t.t("phoneRequired.networkError")
                submitting = false
            }
        }
    }

    if (!ready) return

    Column(Modifier.fillMaxSize().background(HcColors.Cream)) {
        HcAppBar(t.t("phoneRequired.title"), back = false)
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(top = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            HcText(t.t("phoneRequired.intro"), HcTypeRoles.Body)
            HcTextField(
                phone,
                {
                    phone = it
                    error = null
                },
                label = t.t("phoneRequired.label"),
                placeholder = t.t("phoneRequired.placeholder"),
                keyboardType = KeyboardType.Phone,
            )
            HcError(error)
        }
        BottomButton(
            if (submitting) t.t("phoneRequired.submitting") else t.t("phoneRequired.submit"),
            enabled = !submitting,
            onClick = ::handleSubmit,
        )
    }
}

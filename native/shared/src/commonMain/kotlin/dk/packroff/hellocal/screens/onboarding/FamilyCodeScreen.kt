package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** .hf-page.hf-stack: padding 16 / gutter / 32, 8 px gap. */
internal val FamilyPagePadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)

/**
 * Native port of src/app/family-code/page.tsx (docs/FAMILY.md, DECISIONS 2026-10-03).
 * Step 1: invitation code + e-mail (or a scanned QR code giving ?t=). Step 2, for a
 * profile the payer created (e.g. a child): choose a password. An invitation to an
 * existing account continues on /family-code/join.
 */
@Composable
fun FamilyCodeScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val token = args.opt("t") ?: ""
    var qrEmail by remember(token) { mutableStateOf<String?>(null) }
    var code by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember(token) { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun showError(e: Throwable) {
        error = t.t("family.error.${e.familyErrorCode()}")
    }

    LaunchedEffect(token) {
        if (token.isEmpty()) return@LaunchedEffect
        try {
            val data = Api.get("/api/family/invite?t=" + Location.encode(token)).jsonObject
            // An invitation to an existing account belongs on the join page.
            if (data["kind"]?.jsonPrimitive?.contentOrNull == "join") {
                nav.replace("/family-code/join?t=" + Location.encode(token))
                return@LaunchedEffect
            }
            qrEmail = data["email"]?.jsonPrimitive?.contentOrNull ?: ""
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            showError(e)
        }
    }

    fun continueWithCode() {
        error = null
        busy = true
        scope.launch {
            try {
                val data = Api.post("/api/family/invite", mapOf("code" to code, "email" to email)).jsonObject
                val newToken = (data["token"] as? JsonPrimitive)?.takeIf { it.isString }?.content
                busy = false
                if (newToken == null) {
                    error = t.t("family.error.unknown")
                    return@launch
                }
                val next = if (data["kind"]?.jsonPrimitive?.contentOrNull == "join") "/family-code/join" else "/family-code"
                nav.push(next + "?t=" + Location.encode(newToken))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                busy = false
                showError(e)
            }
        }
    }

    fun createLogin() {
        error = null
        busy = true
        scope.launch {
            try {
                Api.post("/api/family/claim", mapOf("token" to token, "password" to password))
                busy = false
                Session.completedExternally()
                nav.resetTo("/")
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                busy = false
                showError(e)
            }
        }
    }

    HcScreen(title = t.t("family.claim.title"), contentPadding = FamilyPagePadding) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (token.isNotEmpty()) {
                // Step 2: profile created by the payer — choose a password.
                val claimEmail = qrEmail
                if (claimEmail != null) {
                    HcText(t.t("family.claim.introQr", "email" to claimEmail), HcTypeRoles.Body)
                    HcTextField(password, { password = it }, label = t.t("family.claim.password"), password = true, standard = true)
                }
                error?.let { HcText(it, HcTypeRoles.Body, color = HcColors.Danger) }
                if (claimEmail != null) {
                    HcButton(t.t("family.claim.submit"), onClick = ::createLogin, enabled = !busy && password.length >= 8)
                } else if (error != null) {
                    HcButton(t.t("family.claim.tryAgain"), onClick = { nav.push("/family-code") }, kind = HcButtonKind.Secondary)
                }
            } else {
                // Step 1: invitation code + e-mail, or scan the QR code.
                HcText(t.t("family.claim.intro"), HcTypeRoles.Body)
                HcTextField(code, { code = it.uppercase() }, label = t.t("family.claim.code"), placeholder = "XXXX-XXXX", standard = true)
                HcTextField(email, { email = it }, label = t.t("family.claim.email"), keyboardType = KeyboardType.Email, standard = true)
                error?.let { HcText(it, HcTypeRoles.Body, color = HcColors.Danger) }
                HcButton(
                    t.t("family.claim.continue"),
                    onClick = ::continueWithCode,
                    enabled = !busy && code.trim().length >= 8 && email.contains('@'),
                )
                HcButton(t.t("family.claim.scan"), onClick = { nav.push("/family-code/scan") }, kind = HcButtonKind.Secondary)
            }
        }
    }
}

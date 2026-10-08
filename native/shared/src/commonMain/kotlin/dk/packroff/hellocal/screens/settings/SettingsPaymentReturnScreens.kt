package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

// Native ports of the two payment return pages:
// - src/app/settings/payment/mobilepay/page.tsx (MobilePay merchantRedirectUrl)
// - src/app/settings/payment/stripe/page.tsx (Stripe Checkout success_url with session_id)
// Status is fetched at once and then every 3 seconds while it is still pending.

private const val SETTINGS_PAYMENT_POLL_INTERVAL_MS = 3000L

/** POST [path] until the state is no longer "pending" (or [maxPolls] is reached); "checking" until the first answer. */
@Composable
private fun rememberSettingsPaymentSyncState(path: String, body: Map<String, Any?>?, maxPolls: Int): String {
    var state by remember { mutableStateOf("checking") }
    LaunchedEffect(path) {
        var polls = 0
        while (true) {
            polls += 1
            val response = runCatching { if (body != null) Api.post(path, body) else Api.post(path) }.getOrNull()
            val next = ((response as? JsonObject)?.get("state"))?.let { runCatching { it.jsonPrimitive.contentOrNull }.getOrNull() } ?: "pending"
            state = next
            if (next == "pending" && polls < maxPolls) delay(SETTINGS_PAYMENT_POLL_INTERVAL_MS) else break
        }
    }
    return state
}

@Composable
private fun SettingsPaymentReturnContent(state: String, textKeyPrefix: String, showMobilePayLogo: Boolean) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    Column(
        Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        if (showMobilePayLogo) HcRemoteImage("/payment/mobilepay.svg", Modifier.size(64.dp), contentDescription = "MobilePay")
        HcText(t.t("$textKeyPrefix.$state"), HcTypeRoles.Body, Modifier.fillMaxWidth(), align = TextAlign.Center)
        if (state != "checking") {
            HcButton(t.t("$textKeyPrefix.back"), onClick = { nav.push("/settings/payment") })
        }
    }
}

@Composable
fun SettingsPaymentMobilePayScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val state = rememberSettingsPaymentSyncState("/api/payments/mobilepay/sync", body = null, maxPolls = 40)
    HcScreen(title = t.t("payment.mobilePayReturn.title"), contentPadding = PaddingValues(24.dp)) {
        SettingsPaymentReturnContent(state, "payment.mobilePayReturn", showMobilePayLogo = true)
    }
}

@Composable
fun SettingsPaymentStripeScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val sessionId = args.opt("session_id")
    val state = rememberSettingsPaymentSyncState("/api/payments/stripe/sync", body = mapOf("sessionId" to sessionId), maxPolls = 20)
    HcScreen(title = t.t("payment.stripeReturn.title"), contentPadding = PaddingValues(24.dp)) {
        SettingsPaymentReturnContent(state, "payment.stripeReturn", showMobilePayLogo = false)
    }
}

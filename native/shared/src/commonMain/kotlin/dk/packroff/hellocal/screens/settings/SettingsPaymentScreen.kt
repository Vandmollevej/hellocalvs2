package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import dk.packroff.hellocal.ui.SettingsPaymentCardIcon
import dk.packroff.hellocal.ui.VSpace
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.time.Duration.Companion.days

// Native port of src/app/settings/payment/page.tsx — Betalingsmetode
// (docs/DECISIONS.md 2026-10-02): the card or wallet Stripe charges the
// subscription to, or MobilePay. Card numbers are never entered here:
// "Skift betalingsmetode" opens Stripe's customer portal, and MobilePay
// Recurring is approved in the MobilePay app.

@Serializable
data class SettingsPaymentSubscriptionDto(
    val status: String = "INACTIVE",
    val provider: String? = null,
    val freeMonthsRemaining: Int = 0,
    val currentPeriodEnd: String? = null,
)

@Serializable
data class SettingsPaymentMethodDto(
    val id: String = "",
    val brand: String = "",
    val provider: String? = null,
    val last4: String? = null,
    val expiryMonth: Int? = null,
    val expiryYear: Int? = null,
    val wallet: String? = null,
)

/** GET /api/subscription?refresh=1 (src/app/api/subscription/route.ts). */
@Serializable
data class SettingsPaymentResponseDto(
    val tier: String? = null,
    val plan: String? = null,
    val coveredByFamily: Boolean = false,
    val subscription: SettingsPaymentSubscriptionDto? = null,
    val paymentMethods: List<SettingsPaymentMethodDto> = emptyList(),
    val testPaymentMethod: SettingsPaymentMethodDto? = null,
    val mobilePayAvailable: Boolean = false,
    val stripeAvailable: Boolean = false,
    val mobilePayPending: Boolean = false,
)

/** Logo chips at the bottom (same chip as PaymentMethodBadges on the purchase page). */
private data class SettingsPaymentSupportedMethod(val label: String, val logo: String, val withName: Boolean = false)

private val SettingsPaymentSupportedMethods = listOf(
    SettingsPaymentSupportedMethod("Visa", "/payment/visa.svg"),
    SettingsPaymentSupportedMethod("Mastercard", "/payment/mastercard.svg"),
    SettingsPaymentSupportedMethod("Apple Pay", "/payment/applepay.svg"),
    SettingsPaymentSupportedMethod("Google Pay", "/payment/googlepay.svg"),
    SettingsPaymentSupportedMethod("MobilePay", "/payment/mobilepay.svg", withName = true),
)

/** What Stripe actually charges (card.brand / card.wallet.type); other brands get a neutral card icon. */
private val SettingsPaymentMethodLogos = mapOf(
    "APPLE_PAY" to "/payment/applepay.svg",
    "GOOGLE_PAY" to "/payment/googlepay.svg",
    "MOBILEPAY" to "/payment/mobilepay.svg",
    "VISA" to "/payment/visa.svg",
    "MASTERCARD" to "/payment/mastercard.svg",
)

private data class SettingsPaymentDescribed(val logoKind: String, val title: String, val caption: String)

private fun settingsPaymentFormatExpiry(month: Int?, year: Int?): String? {
    if (month == null || month == 0 || year == null || year == 0) return null
    return "${month.toString().padStart(2, '0')}/${year.toString().takeLast(2)}"
}

/** new Date(iso).toLocaleDateString("da-DK") → "8.10.2026". */
private fun settingsPaymentFormatDate(iso: String): String? {
    val date = runCatching { Instant.parse(iso).toLocalDateTime(TimeZone.currentSystemDefault()).date }.getOrNull() ?: return null
    return "${date.dayOfMonth}.${date.monthNumber}.${date.year}"
}

/**
 * Dummy view without a Stripe key: ?preview=DK (MobilePay), =DE (EC card),
 * =APPLE (Apple Pay with Visa behind) or =GOOGLE (Google Pay with Mastercard).
 */
private fun settingsPaymentPreviewData(kind: String): SettingsPaymentResponseDto {
    val end = (Clock.System.now() + 30.days).toString()
    val method = when (kind) {
        "DK" -> SettingsPaymentMethodDto(id = "preview", brand = "MOBILEPAY", provider = "STRIPE", last4 = null)
        "APPLE" -> SettingsPaymentMethodDto("preview", "VISA", "STRIPE", "4242", 9, 2027, "APPLE_PAY")
        "GOOGLE" -> SettingsPaymentMethodDto("preview", "MASTERCARD", "STRIPE", "4444", 3, 2028, "GOOGLE_PAY")
        else -> SettingsPaymentMethodDto("preview", "GIROCARD", "STRIPE", "4242", 12, 2026)
    }
    return SettingsPaymentResponseDto(
        subscription = SettingsPaymentSubscriptionDto(status = "ACTIVE", provider = "STRIPE", freeMonthsRemaining = 0, currentPeriodEnd = end),
        paymentMethods = listOf(method),
        mobilePayAvailable = false,
        stripeAvailable = true,
        mobilePayPending = false,
    )
}

private fun settingsPaymentStatusKey(status: String): String = when (status) {
    "ACTIVE" -> "active"
    "TRIALING" -> "trialing"
    "FREE_MONTH" -> "freeMonth"
    "CANCELED" -> "canceled"
    else -> "inactive"
}

/** Title + caption for the active card/wallet. */
private fun settingsPaymentDescribe(t: Translator, method: SettingsPaymentMethodDto): SettingsPaymentDescribed {
    val brandLabel = t.t("payment.methodLabel.${method.brand}")
    val card = if (!method.last4.isNullOrEmpty()) t.t("payment.walletCard", "brand" to brandLabel, "last4" to (method.last4 ?: "")) else brandLabel
    val expiry = settingsPaymentFormatExpiry(method.expiryMonth, method.expiryYear)
    val expires = expiry?.let { t.t("payment.expires", "date" to it) }
    val wallet = method.wallet
    return when {
        !wallet.isNullOrEmpty() -> SettingsPaymentDescribed(
            logoKind = wallet,
            title = t.t("payment.methodLabel.$wallet"),
            caption = listOfNotNull(card, expires).filter { it.isNotEmpty() }.joinToString(" · "),
        )
        method.provider == "STRIPE_TEST" -> SettingsPaymentDescribed(
            logoKind = method.brand,
            title = card,
            caption = listOfNotNull(t.t("payment.testCard"), expires).joinToString(" · "),
        )
        method.brand == "MOBILEPAY" -> SettingsPaymentDescribed("MOBILEPAY", "MobilePay", t.t("payment.mobilePayAgreement"))
        else -> SettingsPaymentDescribed(method.brand, card, expires ?: t.t("payment.recurringNote"))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsPaymentScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val preview = args.opt("preview")?.uppercase()?.ifEmpty { null }
    var data by remember { mutableStateOf<SettingsPaymentResponseDto?>(null) }
    var reloadKey by remember { mutableIntStateOf(0) }
    var stopping by remember { mutableStateOf(false) }
    var confirmStop by remember { mutableStateOf(false) }
    var opening by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(reloadKey) {
        if (preview != null) {
            data = settingsPaymentPreviewData(preview)
            return@LaunchedEffect
        }
        // refresh=1: status and card are fetched from Stripe first, so the page shows
        // the card that is actually charged — also right after a change in the portal.
        runCatching {
            ApiJson.decodeFromJsonElement(SettingsPaymentResponseDto.serializer(), Api.get("/api/subscription?refresh=1"))
        }.getOrNull()?.let { data = it }
    }

    val current = data
    val subscription = current?.subscription
    // Serious without an own agreement (admins are always Seriøs Familie) shows as active.
    val status = if (current?.tier == "SERIOUS" && current?.coveredByFamily != true && (subscription?.status ?: "INACTIVE") == "INACTIVE") {
        "ACTIVE"
    } else {
        subscription?.status ?: "INACTIVE"
    }
    val isFamilyPlan = current?.plan == "FAMILY"
    val periodEnd = subscription?.currentPeriodEnd?.let { settingsPaymentFormatDate(it) }
    // Stripe payment (MobilePay in DK, card/wallet in DE) and MobilePay Recurring can both be stopped here.
    val stripeMethod = current?.paymentMethods?.firstOrNull { it.provider == "STRIPE" }
    val realMethod = stripeMethod
        ?: current?.paymentMethods?.firstOrNull { it.brand == "MOBILEPAY" }
        ?: current?.paymentMethods?.firstOrNull()
    val activeMethod = realMethod ?: current?.testPaymentMethod
    val canChangeMethod = stripeMethod != null && (status == "ACTIVE" || status == "CANCELED")
    val canStop = realMethod != null && status == "ACTIVE"
    val stopLabel = if (stripeMethod != null && stripeMethod.brand != "MOBILEPAY") t.t("payment.stopSubscription") else t.t("payment.stopAgreement")
    val statusDetail = when {
        status == "ACTIVE" && periodEnd != null -> t.t("payment.nextPayment", "date" to periodEnd)
        status == "CANCELED" && periodEnd != null -> t.t("payment.canceledUntil", "date" to periodEnd)
        else -> null
    }

    fun stopAgreement() {
        if (preview != null) {
            confirmStop = false
            return
        }
        stopping = true
        error = null
        scope.launch {
            try {
                Api.post(if (stripeMethod != null) "/api/payments/stripe/cancel" else "/api/payments/mobilepay/cancel")
                confirmStop = false
                reloadKey++
            } catch (e: ApiException) {
                error = (e.body as? JsonObject)?.get("message")?.jsonPrimitive?.contentOrNull ?: t.t("payment.stopError")
            } catch (e: Exception) {
                error = t.t("payment.stopError")
            } finally {
                stopping = false
            }
        }
    }

    fun changeMethod() {
        if (preview != null) return
        opening = true
        error = null
        scope.launch {
            try {
                val url = Api.post("/api/payments/stripe/portal").jsonObject["url"]?.jsonPrimitive?.contentOrNull
                if (url.isNullOrEmpty()) {
                    error = t.t("payment.changeError")
                } else {
                    // TODO(parity): the web reloads this page when Stripe's portal returns;
                    // natively the data is refreshed only when the screen is opened again.
                    NativeHooks.openExternalUrl(url)
                }
            } catch (e: ApiException) {
                error = (e.body as? JsonObject)?.get("message")?.jsonPrimitive?.contentOrNull ?: t.t("payment.changeError")
            } catch (e: Exception) {
                error = t.t("payment.changeError")
            } finally {
                opening = false
            }
        }
    }

    HcScreen(title = t.t("payment.title"), contentPadding = SettingsPagePadding) {
        if (current == null) {
            HcLoader()
            return@HcScreen
        }
        SettingsPage(gap = HcDimens.SpaceBlock) {
            // Status card
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(HcDimens.RadiusCard))
                    .background(HcColors.Action)
                    .padding(16.dp),
            ) {
                val statusTextKey = if (status == "ACTIVE" && isFamilyPlan) "activeFamily" else settingsPaymentStatusKey(status)
                HcText(t.t("payment.status.$statusTextKey"), HcTypeRoles.Body, color = HcColors.White)
                if (statusDetail != null) {
                    HcText(statusDetail, HcTypeRoles.Small, Modifier.padding(top = 4.dp), color = HcColors.White)
                }
                if (subscription != null && subscription.freeMonthsRemaining > 0) {
                    HcText(
                        t.t("payment.freeMonthsRemaining", "count" to subscription.freeMonthsRemaining),
                        HcTypeRoles.Small,
                        Modifier.padding(top = 4.dp),
                        color = HcColors.White,
                    )
                }
            }

            Column(Modifier.fillMaxWidth()) {
                HcSectionTitle(t.t("payment.paymentMethodsTitle"))
                VSpace(24.dp)
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (activeMethod != null) {
                        val shape = RoundedCornerShape(HcDimens.RadiusCard)
                        Column(
                            Modifier.fillMaxWidth().border(1.dp, HcColors.Line, shape).padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            val described = settingsPaymentDescribe(t, activeMethod)
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                SettingsPaymentMethodLogo(described.logoKind)
                                Column(Modifier.weight(1f)) {
                                    HcText(described.title, HcTypeRoles.Body, color = HcColors.Black, maxLines = 1)
                                    HcText(described.caption, HcTypeRoles.Caption, maxLines = 1)
                                }
                            }

                            if (canChangeMethod && !confirmStop) {
                                HcButton(
                                    if (opening) t.t("payment.opening") else t.t("payment.changeMethod"),
                                    onClick = ::changeMethod,
                                    kind = HcButtonKind.Secondary,
                                    enabled = !opening,
                                )
                            }

                            if (canStop) {
                                if (confirmStop) {
                                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        HcText(
                                            if (periodEnd != null) t.t("payment.stopConfirmUntil", "date" to periodEnd) else t.t("payment.stopConfirm"),
                                            HcTypeRoles.Caption,
                                        )
                                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            HcButton(
                                                t.t("payment.keepAgreement"),
                                                onClick = { confirmStop = false },
                                                modifier = Modifier.weight(1f),
                                                kind = HcButtonKind.Secondary,
                                                enabled = !stopping,
                                            )
                                            HcButton(
                                                if (stopping) t.t("payment.stopping") else stopLabel,
                                                onClick = ::stopAgreement,
                                                modifier = Modifier.weight(1f),
                                                enabled = !stopping,
                                            )
                                        }
                                    }
                                } else {
                                    SettingsPaymentTextButton(stopLabel, onClick = { confirmStop = true })
                                }
                            }
                            if (error != null) HcText(error ?: "", HcTypeRoles.Small, color = HcColors.RedDark)
                        }
                    }

                    if (activeMethod == null) {
                        Box(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan).padding(16.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            HcText(
                                if (current.mobilePayPending) t.t("payment.pendingApproval") else t.t("payment.noPaymentMethod"),
                                HcTypeRoles.Body,
                                color = HcColors.Black,
                                align = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                        }
                    }

                    if (activeMethod == null && !current.mobilePayPending && (current.mobilePayAvailable || current.stripeAvailable)) {
                        HcButton(t.t("payment.chooseSubscription"), onClick = { nav.push("/profile/subscription") })
                    }
                }
            }

            Column(Modifier.fillMaxWidth()) {
                HcSectionTitle(t.t("payment.supportedMethodsTitle"))
                VSpace(24.dp)
                FlowRow(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    SettingsPaymentSupportedMethods.forEach { method ->
                        SettingsPaymentLogoBadge(method.logo, method.label, method.withName)
                    }
                }
            }
        }
    }
}

/** Card icon in a fixed frame (like a small payment card), so every brand takes the same space. */
@Composable
private fun SettingsPaymentMethodLogo(kind: String) {
    val logo = SettingsPaymentMethodLogos[kind]
    Box(
        Modifier.size(width = 48.dp, height = 32.dp).clip(RoundedCornerShape(6.dp)).background(HcColors.Tan),
        contentAlignment = Alignment.Center,
    ) {
        if (logo != null) {
            HcRemoteImage(logo, Modifier.size(width = 36.dp, height = 20.dp))
        } else {
            SettingsPaymentCardIcon(size = 20.dp, color = HcColors.Black)
        }
    }
}

/** LogoBadge from src/components/hf/PaymentMethodBadges.tsx — 64 × 40 tan chip (or logo + name). */
@Composable
private fun SettingsPaymentLogoBadge(src: String, label: String, withName: Boolean) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Row(
        Modifier
            .height(40.dp)
            .clip(shape)
            .background(HcColors.Tan)
            .let { if (withName) it.padding(horizontal = 12.dp) else it.width(64.dp) },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
    ) {
        HcRemoteImage(src, Modifier.size(width = if (withName) 24.dp else 40.dp, height = 24.dp), contentDescription = if (withName) null else label)
        if (withName) HcText(label, HcTypeRoles.Small, bold = true)
    }
}

/** .hf-control .hf-btn-text — 48 px tall, bold 15 px, left aligned (self-start). */
@Composable
private fun SettingsPaymentTextButton(label: String, onClick: () -> Unit) {
    Box(
        Modifier.height(HcDimens.ControlHeight).clip(RoundedCornerShape(HcDimens.RadiusCard)).clickable(onClick = onClick),
        contentAlignment = Alignment.CenterStart,
    ) {
        HcText(label, HcTypeRoles.Body, bold = true, color = HcColors.Action)
    }
}

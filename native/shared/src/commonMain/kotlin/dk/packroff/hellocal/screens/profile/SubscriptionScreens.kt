package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.ProfileAccordionCard
import dk.packroff.hellocal.ui.ProfileCenteredText
import dk.packroff.hellocal.ui.ProfileChevronRow
import dk.packroff.hellocal.ui.ProfileFilledField
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import dk.packroff.hellocal.ui.ProfileTermsSheet
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

/** GET /api/subscription — the fields the subscription pages use. */
private data class SubscriptionData(
    val tier: String,
    val status: String,
    val currentPeriodEnd: String?,
    val pointsBalance: Int,
    val plan: String,
    val coveredByFamily: Boolean,
)

private fun parseSubscription(obj: JsonObject) = SubscriptionData(
    tier = obj["tier"]?.jsonPrimitive?.contentOrNull ?: "FREE",
    status = obj["status"]?.jsonPrimitive?.contentOrNull ?: "INACTIVE",
    currentPeriodEnd = obj["currentPeriodEnd"]?.let { (it as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull },
    pointsBalance = obj["pointsBalance"]?.jsonPrimitive?.intOrNull ?: 0,
    plan = obj["plan"]?.jsonPrimitive?.contentOrNull ?: "INDIVIDUAL",
    coveredByFamily = obj["coveredByFamily"]?.jsonPrimitive?.booleanOrNull == true,
)

/** Native port of src/app/profile/subscription/page.tsx. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SubscriptionScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<SubscriptionData?>(null) }
    var loading by remember { mutableStateOf(true) }
    var giftCode by remember { mutableStateOf("") }
    var redeeming by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val requesters = remember { mapOf("free" to BringIntoViewRequester(), "serious" to BringIntoViewRequester(), "family" to BringIntoViewRequester()) }

    suspend fun load() {
        runCatching { Api.get("/api/subscription") as JsonObject }.getOrNull()?.let { data = parseSubscription(it) }
        loading = false
    }
    LaunchedEffect(Unit) { load() }

    fun redeemGiftCode() {
        if (giftCode.isBlank()) return
        redeeming = true
        message = null
        scope.launch {
            try {
                val json = Api.post("/api/subscription/redeem-gift-code", mapOf("code" to giftCode)) as? JsonObject
                giftCode = ""
                val end = json?.get("currentPeriodEnd")?.jsonPrimitive?.contentOrNull
                message = t.t("subscription.giftCode.success", "date" to ProfileDates.shortDate(end))
                load()
            } catch (e: ApiException) {
                message = e.message.ifBlank { t.t("subscription.giftCode.genericError") }
            } catch (e: Exception) {
                message = t.t("subscription.giftCode.genericError")
            } finally {
                redeeming = false
            }
        }
    }

    HcScreen(title = t.t("subscription.title"), contentPadding = ProfilePagePadding) {
        val current = data
        when {
            loading -> HcLoader()
            current == null -> ProfileCenteredText(t.t("subscription.loadError"))
            else -> ProfilePage {
                val currentPlan = if (current.tier != "SERIOUS") "free" else if (current.plan == "FAMILY") "family" else "serious"
                // The three plans at the top; a tap scrolls down to the plan's card.
                PlanOverview(currentPlan, requesters)

                dk.packroff.hellocal.ui.HcCard {
                    HcText(t.t("subscription.giftCode.label"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProfileFilledField(
                            giftCode,
                            { giftCode = it.uppercase() },
                            Modifier.weight(1f),
                            placeholder = t.t("subscription.giftCode.placeholder"),
                            enabled = !redeeming,
                            onCommit = null,
                            background = HcColors.White,
                            shape = RoundedCornerShape(8.dp),
                        )
                        val enabled = !redeeming && giftCode.isNotBlank()
                        val shape = RoundedCornerShape(HcDimens.RadiusCard)
                        Box(
                            Modifier.size(48.dp).clip(shape).background(HcColors.Action, shape).clickable(enabled = enabled, onClick = ::redeemGiftCode),
                            contentAlignment = Alignment.Center,
                        ) { HcIcon("ArrowRight", size = 20.dp, color = if (enabled) HcColors.White else HcColors.Disabled, contentDescription = t.t("subscription.giftCode.submitAria")) }
                    }
                    message?.let { HcText(it, HcTypeRoles.Caption) }
                }

                val cardShape = RoundedCornerShape(HcDimens.RadiusCard)
                Column(
                    Modifier.fillMaxWidth().clip(cardShape).background(HcColors.Disabled, cardShape).clickable { nav.push("/profile/subscription/redeem-points") }.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    HcText(t.t("subscription.redeemPoints"), HcTypeRoles.CardTitle, color = HcColors.White)
                    HcText(t.t("subscription.pointsEarned", "balance" to current.pointsBalance), HcTypeRoles.Body, color = HcColors.White)
                }

                HcSectionTitle(t.t("subscription.currentPlan"))

                val serious = current.tier == "SERIOUS"
                val fg = if (serious) HcColors.White else HcColors.Text
                Column(
                    Modifier.fillMaxWidth().clip(cardShape).background(if (serious) HcColors.Brand else HcColors.Card, cardShape).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (serious) HcIcon("Star", size = 18.dp, color = fg)
                        HcText(t.t("subscription.tier.${if (serious) "serious" else "free"}"), HcTypeRoles.CardTitle, color = fg)
                    }
                    if (serious) {
                        // A running paid subscription renews on the end date; a gift code / free month just ends.
                        if (current.currentPeriodEnd != null) {
                            HcText(
                                t.t(
                                    if (current.status == "ACTIVE" || current.status == "TRIALING") "subscription.nextPayment" else "subscription.activeUntil",
                                    "date" to ProfileDates.shortDate(current.currentPeriodEnd),
                                ),
                                HcTypeRoles.Body,
                                color = fg,
                            )
                        }
                    } else {
                        HcText(t.t("subscription.freePlan.description"), HcTypeRoles.Body, color = fg)
                    }
                }

                // Seriøs Familie: invitations, profiles and access live on /profile/family (docs/FAMILY.md).
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(cardShape).background(HcColors.Tan, cardShape).clickable { nav.push("/profile/family") }.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    HcIcon("Users", size = 20.dp, color = HcColors.Black)
                    HcText(
                        if (current.plan == "FAMILY" || current.coveredByFamily) t.t("family.switcher.manage") else t.t("family.join.title"),
                        HcTypeRoles.Body,
                        Modifier.weight(1f),
                    )
                    HcIcon("ChevronRight", size = 20.dp, color = HcColors.Black, modifier = Modifier.alpha(0.6f))
                }

                HcButton(t.t("subscription.paymentMethods"), onClick = { nav.push("/settings/payment") }, kind = HcButtonKind.Secondary)

                HcSectionTitle(t.t("subscription.plansHeading"), Modifier.padding(top = 8.dp))
                // The same three plan cards as on the public front page (LandingPlans).
                LandingPlans(currentPlan, requesters)
                Box(Modifier.padding(top = 8.dp)) { ProfileTermsSheet(SUBSCRIPTION_OVERVIEW_TERMS) }
            }
        }
    }
}

// Everything Seriøs unlocks (same list as the locked features in the app).
private val FEATURE_KEYS = listOf("history", "statistics", "photoDiary", "customize", "display", "allergens", "integrations", "subGoals", "helloDoc")

/**
 * Native port of src/app/profile/subscription/[plan]/page.tsx — one page per
 * subscription (Seriøs, Seriøs Familie) with 1, 3 or 12 months. Payment opens
 * Stripe/MobilePay in the browser (confirmationUrl), like the web redirect.
 */
@Composable
fun SubscriptionPlanScreen(args: RouteArgs) {
    val plan = args["plan"]
    key(plan, args.opt("months"), args.opt("preview")) { SubscriptionPlan(plan, args.opt("months"), args.opt("preview")) }
}

@Composable
private fun SubscriptionPlan(plan: String, monthsParam: String?, previewParam: String?) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    if (plan != "serious" && plan != "family") {
        HcScreen(title = "Hello Cal") { ProfileCenteredText("404") }
        return
    }
    // Period chosen in the front page's checkout sheet (?months=1|3|12).
    var months by remember { mutableStateOf(monthsParam?.toIntOrNull()?.takeIf { it in SUBSCRIPTION_PERIODS } ?: 12) }
    // Confirm immediate delivery and the right of withdrawal before buying.
    var withdrawalAck by remember { mutableStateOf(false) }
    var paymentAvailable by remember { mutableStateOf(false) }
    var useStripe by remember { mutableStateOf(false) }
    var market by remember { mutableStateOf<PaymentMarket?>(null) }
    var buying by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    // Dummy view without a Stripe key: ?preview=DK or =DE.
    val previewCountry = previewParam?.uppercase()?.takeIf { it == "DK" || it == "DE" }

    LaunchedEffect(Unit) {
        if (previewCountry != null) {
            useStripe = true
            market = PaymentMarket(previewCountry, if (previewCountry == "DE") "eur" else "dkk")
            paymentAvailable = true
            return@LaunchedEffect
        }
        val json = runCatching { Api.get("/api/subscription") as JsonObject }.getOrNull()
        val stripe = json?.get("stripeAvailable")?.jsonPrimitive?.booleanOrNull == true
        val mobilePay = json?.get("mobilePayAvailable")?.jsonPrimitive?.booleanOrNull == true
        useStripe = stripe
        market = paymentMarketOf(json?.get("paymentMarket"))
        paymentAvailable = stripe || mobilePay
    }

    val currency = market?.currency ?: "dkk"
    fun priceFor(period: Int) = marketPrice(market, plan, period)
    val monthlyBase = priceFor(1)
    val price = priceFor(months)

    fun buy() {
        if (!paymentAvailable || !withdrawalAck || buying) return
        if (previewCountry != null) return // dummy: no real payment
        buying = true
        error = null
        scope.launch {
            try {
                val json = Api.post(
                    if (useStripe) "/api/payments/stripe/checkout" else "/api/payments/mobilepay/agreement",
                    mapOf("plan" to plan, "months" to months, "withdrawalAck" to true),
                ) as? JsonObject
                val url = json?.get("confirmationUrl")?.jsonPrimitive?.contentOrNull
                if (url == null) {
                    error = json?.get("message")?.jsonPrimitive?.contentOrNull ?: t.t("subscription.planPage.buyError")
                } else {
                    NativeHooks.openExternalUrl(url)
                }
            } catch (e: ApiException) {
                error = (e.body as? JsonObject)?.get("message")?.jsonPrimitive?.contentOrNull ?: t.t("subscription.planPage.buyError")
            } catch (e: Exception) {
                error = t.t("subscription.planPage.buyError")
            }
            buying = false
        }
    }

    HcScreen(
        title = t.t("subscription.plans.$plan.title"),
        bottom = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ProfileTermsSheet(SUBSCRIPTION_PLAN_TERMS.getValue(plan))
                HcToggle(withdrawalAck, { withdrawalAck = it }, label = t.t("subscription.seriousPlan.withdrawalConsent"))
                market?.let { PaymentMethodBadges(it.country) }
                HcButton(t.t("subscription.planPage.buyCta"), onClick = ::buy, enabled = paymentAvailable && withdrawalAck && !buying)
                error?.let { HcText(it, HcTypeRoles.Caption, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center) }
                if (!paymentAvailable) {
                    HcText(t.t("subscription.seriousPlan.upgradeUnavailable"), HcTypeRoles.Caption, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                }
            }
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            val shape = RoundedCornerShape(8.dp)
            Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Brand, shape).padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcIcon("Star", size = 18.dp, color = HcColors.White)
                    HcText(t.t("subscription.plans.$plan.title"), HcTypeRoles.SectionTitle, color = HcColors.White)
                }
                HcText(t.t("subscription.plans.$plan.description"), HcTypeRoles.Body, Modifier.padding(top = 8.dp).alpha(0.9f), color = HcColors.White)
            }

            Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(16.dp)) {
                HcText(t.t("subscription.planPage.includesHeading"), HcTypeRoles.Body, bold = true)
                Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    FEATURE_KEYS.forEach { feature ->
                        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            HcIcon("Check", size = 18.dp, color = HcColors.Black, modifier = Modifier.padding(top = 2.dp))
                            HcText(t.t("subscription.features.$feature"), HcTypeRoles.Body)
                        }
                    }
                }
            }

            HcSectionTitle(t.t("subscription.planPage.periodHeading"), Modifier.padding(top = 8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SUBSCRIPTION_PERIODS.forEach { period ->
                    val total = priceFor(period)
                    val perMonth = total / period
                    val savingPct = jsRound((1 - total / (monthlyBase * period)) * 100).toInt()
                    val factor = if (currency == "eur") 100.0 else 1.0
                    PeriodBox(
                        label = t.t("subscription.planPage.period.$period"),
                        total = t.t("subscription.planPage.price", "price" to formatMoney(total, currency)),
                        perMonth = t.t("subscription.planPage.perMonth", "price" to formatMoney(jsRound(perMonth * factor) / factor, currency)),
                        saving = if (savingPct > 0) t.t("subscription.planPage.save", "pct" to savingPct) else null,
                        selected = months == period,
                        onClick = { months = period },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            // Price and binding period for the chosen period, so it is clear what you pay and bind yourself to.
            Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(16.dp)) {
                HcText(
                    t.t("subscription.planPage.summaryPrice", "price" to formatMoney(price, currency), "unit" to t.t("subscription.planPage.unit.$months")),
                    HcTypeRoles.SectionTitle,
                )
                HcText(
                    t.t("subscription.planPage.summaryBinding", "period" to t.t("subscription.planPage.bindingPeriod.$months")),
                    HcTypeRoles.Body,
                    Modifier.padding(top = 4.dp),
                )
            }
            HcText(t.t("subscription.planPage.renewalNote"), HcTypeRoles.Caption, color = HcColors.TextSecondary)
        }
    }
}

/** Native port of src/app/profile/subscription/redeem-points/page.tsx — ways to redeem points (content comes later). */
@Composable
fun RedeemPointsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    HcScreen(title = t.t("subscription.redeemPage.title"), bottom = { ProfileTermsSheet(REDEEM_POINTS_TERMS) }) {
        ProfileAccordionCard {
            // Like ChevronRow, but the text may wrap — it is too long for one line.
            ProfileChevronRow(
                label = t.t("subscription.redeemPage.giftFriend"),
                onClick = {},
                icon = { HcIcon("Gift", size = 20.dp, color = HcColors.Black) },
                divider = false,
                wrapLabel = true,
            )
        }
    }
}

package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.ProfileTermsHint
import dk.packroff.hellocal.ui.formatNumber
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

// src/lib/subscription-plans.ts, src/lib/payments/stripe-markets.ts,
// src/lib/landing-content.ts PLANS and src/lib/terms-hints.ts — copied so the
// app shows the same prices, plans and terms as the web.

val SUBSCRIPTION_PERIODS = listOf(1, 3, 12)

val SUBSCRIPTION_PRICES_DKK: Map<String, Map<Int, Double>> = mapOf(
    "serious" to mapOf(1 to 119.0, 3 to 299.0, 12 to 1071.0),
    "family" to mapOf(1 to 179.0, 3 to 449.0, 12 to 1611.0),
)

val SUBSCRIPTION_PRICES_EUR: Map<String, Map<Int, Double>> = mapOf(
    "serious" to mapOf(1 to 15.99, 3 to 39.99, 12 to 143.99),
    "family" to mapOf(1 to 23.99, 3 to 59.99, 12 to 215.99),
)

/** A Stripe market (DK: MobilePay/DKK, DE: card incl. EC/EUR). */
data class PaymentMarket(val country: String, val currency: String)

fun paymentMarketOf(json: kotlinx.serialization.json.JsonElement?): PaymentMarket? {
    val obj = json as? JsonObject ?: return null
    val country = obj["country"]?.jsonPrimitive?.contentOrNull ?: return null
    return PaymentMarket(country, obj["currency"]?.jsonPrimitive?.contentOrNull ?: "dkk")
}

fun marketPrice(market: PaymentMarket?, plan: String, months: Int): Double =
    (if (market?.currency == "eur") SUBSCRIPTION_PRICES_EUR else SUBSCRIPTION_PRICES_DKK)[plan]?.get(months) ?: 0.0

/** Intl currency format: "1.071 kr." (DKK) or "15,99 €" (EUR); no decimals for whole amounts. */
fun formatMoney(value: Double, currency: String): String {
    val whole = value == kotlin.math.floor(value)
    val number = formatNumber(value, 2, minDecimals = if (whole) 0 else 2)
    return if (currency == "eur") "$number €" else "$number kr."
}

/** "1.071 kr." — value.toLocaleString("da-DK") + " kr." (LandingPlans.tsx). */
fun kr(value: Double): String = "${formatNumber(value, 3, minDecimals = 0)} kr."

data class PlanItem(val text: String, val included: Boolean)

data class LandingPlan(val plan: String?, val name: String, val price: String, val note: String, val items: List<PlanItem>, val featured: Boolean = false)

val PLANS = listOf(
    LandingPlan(
        null, "Gratis", "0 kr.", "for altid",
        listOf(
            PlanItem("Kalorier, vand og vægt", true),
            PlanItem("Scan stregkoder", true),
            PlanItem("3 måneders historik", true),
            PlanItem("Statistik og fotodagbog", false),
            PlanItem("Integrationer", false),
        ),
    ),
    LandingPlan(
        "serious", "Seriøs", "119 kr.", "pr. måned",
        listOf(
            PlanItem("Alt i Gratis", true),
            PlanItem("Hele din historik", true),
            PlanItem("Statistik og fotodagbog", true),
            PlanItem("Delmål og egne visninger", true),
            PlanItem("Integrationer", true),
        ),
        featured = true,
    ),
    LandingPlan(
        "family", "Seriøs Familie", "179 kr.", "pr. måned",
        listOf(
            PlanItem("Alt i Seriøs", true),
            PlanItem("Op til 5 personer", true),
            PlanItem("Børneprofiler", true),
            PlanItem("Egen konto til hver", true),
            PlanItem("Ingen reklamer for familien", true),
        ),
    ),
)

val SUBSCRIPTION_OVERVIEW_TERMS = ProfileTermsHint(
    "abonnement",
    listOf(
        "Du kan bruge Hello Cal gratis eller med et betalt abonnement. Pris, indhold og betalingsmåde står tydeligt, før du køber.",
        "Et betalt abonnement betales forud og fornyes automatisk, indtil du opsiger det. Det gælder også efter en gratis måned via points eller en gavekode.",
        "Du kan opsige når som helst med virkning fra udgangen af den periode, du har betalt for. Har du købt via App Store eller Google Play, opsiger du dér. Det stopper ikke abonnementet at slette appen.",
        "Går du ned til den gratis udgave, bliver historik ældre end 3 måneder skjult, men ikke slettet. Den kommer igen, hvis du opgraderer.",
    ),
)

val SUBSCRIPTION_PLAN_TERMS = mapOf(
    "serious" to ProfileTermsHint(
        "fortrydelsesret",
        listOf(
            "Seriøs giver fuld adgang i den periode, du vælger: 1, 3 eller 12 måneder. Prisen for hele perioden betales forud, og abonnementet fornyes automatisk med samme periode, indtil du opsiger det.",
            "Du har 14 dages fortrydelsesret fra købet. Tager du abonnementet i brug med det samme, beder vi dig bekræfte det ved købet. Fortryder du alligevel, refunderer vi beløbet med fradrag for den del af perioden, du har brugt.",
            "Køb via App Store eller Google Play refunderes efter deres regler og kun af dem.",
        ),
    ),
    "family" to ProfileTermsHint(
        "abonnement",
        listOf(
            "Seriøs Familie er et betalt abonnement for hele familien. Den, der betaler, opsætter familien og bestemmer, hvem der er med.",
            "Abonnementet betales forud for den periode, du vælger, og fornyes automatisk, indtil du opsiger det. Du kan opsige når som helst med virkning fra udgangen af den betalte periode.",
            "Du har 14 dages fortrydelsesret fra købet, på samme vilkår som for Seriøs.",
        ),
    ),
)

val REDEEM_POINTS_TERMS = ProfileTermsHint(
    "pointsystem",
    listOf(
        "300 points kan indløses til én gratis måned af det betalte abonnement, dog højst 12 gratis måneder i alt pr. konto.",
        "Points har ingen kontantværdi og kan ikke overdrages. Vi kan annullere points, der er optjent ved misbrug.",
        "Efter en gratis måned fornyes abonnementet automatisk, hvis du har et betalt abonnement, indtil du opsiger det.",
    ),
)

private val PERIOD_LABEL = mapOf(1 to "1 måned", 3 to "3 måneder", 12 to "1 år")

private val planGradient = Brush.linearGradient(listOf(HcColors.Green, HcColors.GreenDark))

/**
 * src/components/hf/PaymentMethodBadges.tsx — DK = MobilePay, DE = card and EC card.
 * The logos are SVGs the image loader cannot draw, so the badges show the names.
 */
@Composable
fun PaymentMethodBadges(country: String) {
    if (country != "DK" && country != "DE") return
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
        val labels = if (country == "DK") listOf("MobilePay") else listOf("Visa", "Mastercard", "EC-Karte")
        labels.forEach { label ->
            val shape = RoundedCornerShape(HcDimens.RadiusCard)
            Box(Modifier.heightIn(min = 40.dp).clip(shape).background(HcColors.Tan, shape).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                HcText(label, HcTypeRoles.Small, bold = true)
            }
        }
    }
}

/** A period box (1, 3 or 12 months) with total, per-month price and the saving. */
@Composable
fun PeriodBox(label: String, total: String, perMonth: String, saving: String?, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(8.dp)
    Column(
        modifier.clip(shape).background(if (selected) HcColors.Tan else HcColors.White, shape)
            .border(2.dp, if (selected) HcColors.Black else HcColors.White.copy(alpha = 0f), shape)
            .clickable(onClick = onClick).padding(horizontal = 4.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        HcText(label, HcTypeRoles.Small, bold = true, align = TextAlign.Center)
        HcText(total, HcTypeRoles.SectionTitle, align = TextAlign.Center)
        HcText(perMonth, HcTypeRoles.Caption, color = HcColors.TextSecondary, align = TextAlign.Center)
        if (saving != null) {
            Box(Modifier.clip(RoundedCornerShape(50)).background(HcColors.Green).padding(horizontal = 8.dp, vertical = 2.dp)) {
                HcText(saving, HcTypeRoles.Caption, bold = true, color = HcColors.White)
            }
        }
    }
}

/** PlanOverview — the three plans in three columns; a tap scrolls to the plan's card. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PlanOverview(currentPlan: String, requesters: Map<String, BringIntoViewRequester>) {
    val scope = rememberCoroutineScope()
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        PLANS.forEach { p ->
            val key = p.plan ?: "free"
            val isCurrent = currentPlan == key
            val shape = RoundedCornerShape(8.dp)
            Column(
                Modifier.weight(1f).clip(shape)
                    .let { if (p.plan != null) it.background(planGradient, shape) else it.background(HcColors.White, shape) }
                    .let { if (isCurrent) it.border(4.dp, HcColors.GreenLight, shape) else it }
                    .clickable { scope.launch { requesters[key]?.bringIntoView() } }
                    .padding(horizontal = 4.dp, vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                val fg = if (p.plan != null) HcColors.White else HcColors.Black
                HcText(p.name, HcTypeRoles.Small, bold = true, color = fg, align = TextAlign.Center)
                HcText(p.price, HcTypeRoles.Title, color = fg, align = TextAlign.Center)
                HcText(p.note, HcTypeRoles.Micro, Modifier.alpha(0.75f), color = fg, align = TextAlign.Center)
                HcText(if (isCurrent) "Din plan" else "Se mere", HcTypeRoles.Micro, Modifier.padding(top = 4.dp), bold = true, underline = true, color = fg)
            }
        }
    }
}

/** LandingPlans — the three full plan cards; "Vælg" opens the checkout sheet. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun LandingPlans(currentPlan: String, requesters: Map<String, BringIntoViewRequester>) {
    var open by remember { mutableStateOf<LandingPlan?>(null) }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        PLANS.forEach { p ->
            val key = p.plan ?: "free"
            val isCurrent = currentPlan == key
            val shape = RoundedCornerShape(24.dp)
            Column(
                Modifier.fillMaxWidth().let { m -> requesters[key]?.let { m.bringIntoViewRequester(it) } ?: m }
                    .shadow(12.dp, shape).clip(shape).background(HcColors.White, shape)
                    .let { if (p.featured) it.border(4.dp, HcColors.GreenLight, shape) else it },
            ) {
                Column(
                    Modifier.fillMaxWidth().background(planGradient).padding(horizontal = 24.dp, vertical = 32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    if (p.featured) HcText("MEST VALGT", HcTypeRoles.Micro, Modifier.padding(bottom = 8.dp), bold = true, color = HcColors.GreenLight)
                    HcText(p.name, HcTypeRoles.PageTitle, color = HcColors.White, align = TextAlign.Center)
                    HcText(p.price, HcTypeRoles.Hero, Modifier.padding(top = 12.dp), color = HcColors.White, align = TextAlign.Center)
                    HcText(p.note, HcTypeRoles.Small, Modifier.padding(top = 4.dp).alpha(0.75f), color = HcColors.White)
                }
                Column(Modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    p.items.forEach { item ->
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            HcText(item.text, HcTypeRoles.Body, Modifier.weight(1f), color = if (item.included) HcColors.Black else HcColors.TextSecondary)
                            if (item.included) HcIcon("Check", size = 18.dp, color = HcColors.Green, contentDescription = "Inkluderet")
                            else HcIcon("X", size = 18.dp, color = HcColors.RedDark, contentDescription = "Ikke inkluderet")
                        }
                    }
                }
                Box(Modifier.fillMaxWidth().padding(start = 32.dp, end = 32.dp, bottom = 32.dp), contentAlignment = Alignment.Center) {
                    val pill = RoundedCornerShape(50)
                    when {
                        isCurrent -> Box(Modifier.clip(pill).background(HcColors.Tan).padding(horizontal = 24.dp, vertical = 12.dp)) {
                            HcText("DIN PLAN", HcTypeRoles.Button, color = HcColors.Black)
                        }
                        p.plan == null -> Unit
                        else -> Box(Modifier.clip(pill).background(HcColors.Black).clickable { open = p }.padding(horizontal = 24.dp, vertical = 12.dp)) {
                            HcText("VÆLG", HcTypeRoles.Button, color = HcColors.White)
                        }
                    }
                }
            }
        }
    }
    open?.let { plan -> CheckoutSheet(plan.plan ?: "serious", plan.name) { open = null } }
}

/** CheckoutSheet (LandingPlans.tsx): period and payment for Seriøs / Seriøs Familie. */
@Composable
private fun CheckoutSheet(plan: String, name: String, onClose: () -> Unit) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var months by remember { mutableStateOf(12) }
    var ack by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val prices = SUBSCRIPTION_PRICES_DKK.getValue(plan)
    val planPage = "/profile/subscription/$plan?months=$months"

    fun pay() {
        if (!ack || busy) return
        busy = true
        error = null
        scope.launch {
            try {
                val response = Api.post("/api/payments/stripe/checkout", mapOf("plan" to plan, "months" to months, "withdrawalAck" to true)) as? JsonObject
                val url = response?.get("confirmationUrl")?.jsonPrimitive?.contentOrNull
                onClose()
                if (url != null) NativeHooks.openExternalUrl(url) else nav.push(planPage)
            } catch (e: ApiException) {
                onClose()
                // Stripe not open in the user's country etc.: the plan page picks the payment itself.
                if (e.status == 401) nav.push("/signup?next=${Location.encode(planPage)}") else nav.push(planPage)
            } catch (e: Exception) {
                error = "Betalingen svarer ikke lige nu. Prøv igen om lidt."
                busy = false
            }
        }
    }

    HcBottomSheet(onDismiss = onClose, title = name) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SUBSCRIPTION_PERIODS.forEach { period ->
                    val total = prices.getValue(period)
                    val saving = jsRound((1 - total / (prices.getValue(1) * period)) * 100).toInt()
                    PeriodBox(
                        label = PERIOD_LABEL.getValue(period),
                        total = kr(total),
                        perMonth = "${kr(jsRound(total / period))}/md.",
                        saving = if (saving > 0) "Spar $saving %" else null,
                        selected = months == period,
                        onClick = { months = period },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            val shape = RoundedCornerShape(8.dp)
            HcText(
                "Du betaler ${kr(prices.getValue(months))} for ${PERIOD_LABEL.getValue(months)}. Abonnementet fornyes automatisk og kan opsiges når som helst inden næste periode.",
                HcTypeRoles.Body,
                Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(16.dp),
            )
            HcToggle(ack, { ack = it }, label = t.t("subscription.seriousPlan.withdrawalConsent"))
            PaymentMethodBadges("DK")
            HcButton("Fortsæt til betaling — ${kr(prices.getValue(months))}", onClick = ::pay, enabled = ack && !busy)
            error?.let { HcText(it, HcTypeRoles.Caption, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center) }
            HcText(
                "Har du ikke en konto, opretter du den først — derefter kommer du direkte til betalingen.",
                HcTypeRoles.Caption,
                Modifier.fillMaxWidth(),
                color = HcColors.TextSecondary,
                align = TextAlign.Center,
            )
        }
    }
}

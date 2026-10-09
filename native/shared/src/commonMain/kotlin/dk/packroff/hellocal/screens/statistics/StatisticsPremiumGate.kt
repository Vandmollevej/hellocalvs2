package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonObject

// src/lib/use-subscription-tier.ts + src/components/PremiumGate.tsx: the
// whole statistics module is Seriøs-only (docs/DECISIONS.md 2026-09-26).

internal object SubscriptionTierCache {
    /** The tier once fetched, so screens opened later know it from the first frame. */
    var resolved: String? = null
        private set
    private val mutex = Mutex()

    suspend fun fetch(): String = mutex.withLock {
        resolved ?: run {
            val tier = attempt { (Api.get("/api/subscription") as? JsonObject)?.string("tier") ?: "FREE" }
            // A failed request is not cached (the web retries on the next mount).
            if (tier != null) resolved = tier
            tier ?: "FREE"
        }
    }
}

/** null while the tier is loading. */
@Composable
internal fun rememberSubscriptionTier(): String? {
    var tier by remember { mutableStateOf(SubscriptionTierCache.resolved) }
    LaunchedEffect(Unit) { tier = SubscriptionTierCache.fetch() }
    return tier
}

/**
 * PremiumGate (src/app/statistics/layout.tsx): Seriøs users see the page;
 * with [renderWhilePending] the page itself draws its skeleton while the tier
 * loads (content gets `pending = true` and waits with its data). Others see
 * the short explanation and the way to Seriøs.
 */
@Composable
internal fun StatisticsPremiumGate(renderWhilePending: Boolean, content: @Composable (pending: Boolean) -> Unit) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val tier = rememberSubscriptionTier()
    if (tier == "SERIOUS" || (tier == null && renderWhilePending)) {
        content(tier == null)
        return
    }
    HcScreen(t.t("statistics.title"), back = nav.showBack) {
        if (tier == "FREE") PremiumUpsell()
    }
}

/** PremiumUpsell in PremiumGate.tsx. */
@Composable
internal fun PremiumUpsell() {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(
            Modifier.fillMaxWidth().background(HcColors.Tan, RoundedCornerShape(HcDimens.RadiusCard)).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            HcIcon("Lock", size = 28.dp)
            HcText(t.t("premium.title"), HcTypeRoles.SectionTitle, align = TextAlign.Center)
            HcText(t.t("premium.description"), HcTypeRoles.Body, color = HcColors.TextSecondary, align = TextAlign.Center)
        }
        HcButton(t.t("premium.cta"), onClick = { nav.push("/profile/subscription/serious") })
    }
}

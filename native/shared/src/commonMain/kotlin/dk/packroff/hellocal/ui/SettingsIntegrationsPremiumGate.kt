package dk.packroff.hellocal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/**
 * src/lib/use-subscription-tier.ts — the subscription tier ("FREE" |
 * "SERIOUS"), fetched once from GET /api/subscription and shared by every
 * screen. A failed fetch counts as "FREE" and is retried next time.
 */
object SettingsIntegrationsTier {
    var resolved: String? = null
        private set

    suspend fun load(): String {
        resolved?.let { return it }
        return try {
            val tier = ((Api.get("/api/subscription") as? JsonObject)?.get("tier") as? JsonPrimitive)?.contentOrNull ?: "FREE"
            resolved = tier
            tier
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            "FREE"
        }
    }
}

/**
 * src/components/PremiumGate.tsx — Seriøs-only pages (docs/DECISIONS.md
 * 2026-09-26). The page itself (and its data loading) is only composed for
 * Seriøs; free users see a short explanation and the way to Seriøs.
 */
@Composable
fun SettingsIntegrationsPremiumGate(titleKey: String, content: @Composable () -> Unit) {
    val t = LocalTranslator.current
    var tier by remember { mutableStateOf(SettingsIntegrationsTier.resolved) }
    LaunchedEffect(Unit) { tier = SettingsIntegrationsTier.load() }

    if (tier == "SERIOUS") {
        content()
        return
    }
    HcScreen(title = t.t(titleKey), contentPadding = PaddingValues(0.dp)) {
        if (tier == "FREE") SettingsIntegrationsPremiumUpsell()
    }
}

/** PremiumUpsell: lock card + "Se Seriøs". */
@Composable
fun SettingsIntegrationsPremiumUpsell() {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(
            Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            HcIcon("Lock", size = 28.dp, color = HcColors.Black)
            HcSectionTitle(t.t("premium.title"))
            HcText(t.t("premium.description"), HcTypeRoles.Body, color = HcColors.TextSecondary, align = TextAlign.Center)
        }
        HcButton(t.t("premium.cta"), onClick = { nav.push("/profile/subscription/serious") })
    }
}

package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.screens.capture.MEAL_KIT_PROVIDERS
import dk.packroff.hellocal.screens.capture.MealKitProvider
import dk.packroff.hellocal.screens.capture.parseRecipeProviders
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsIntegrationsPremiumGate
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

// Sections and order (docs/DECISIONS.md 2026-09-25 "Integrationssiden"):
// Active integrations → Most used → Recipes → Apps → Move from another app.
// Every app has its own page (/settings/integrations/<app>) where the user
// chooses what is read and sent and connects/disconnects (2026-09-26).
private val SETTINGS_INTEGRATIONS_POPULAR = listOf("APPLE_HEALTH", "GOOGLE_HEALTH", "STRAVA")

private fun SettingsIntegrationStatus.settingsIsActive() = status != "DISCONNECTED"

/** Native port of src/app/settings/integrations/page.tsx (inside its Seriøs-only layout). */
@Composable
fun SettingsIntegrationsScreen(args: RouteArgs) {
    SettingsIntegrationsPremiumGate(titleKey = "integrations.title") {
        SettingsIntegrationsOverview()
    }
}

@Composable
private fun SettingsIntegrationsOverview() {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var integrations by remember { mutableStateOf<List<SettingsIntegrationStatus>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    // Meal-kit dishes among "Delte retter" (docs/DECISIONS.md 2026-09-24, 2026-10-10),
    // stored in User.recipeProviders.
    var providers by remember { mutableStateOf<List<String>?>(null) }
    var autoSynced by remember { mutableStateOf(false) }

    suspend fun load() {
        try {
            val list = ApiJson.decodeFromJsonElement(SettingsIntegrationList.serializer(), Api.get("/api/integrations")).integrations
            integrations = list
            // Connected cloud integrations sync when the page opens (the server
            // skips if it happened recently; otherwise the background job does it).
            if (!autoSynced) {
                autoSynced = true
                val toSync = list.filter { it.kind == "oauth" && it.slug != null && it.status == "CONNECTED" }
                if (toSync.isNotEmpty()) {
                    scope.launch {
                        coroutineScope {
                            toSync.map { item -> async { runCatching { Api.post("/api/integrations/${item.slug}/sync") } } }.awaitAll()
                        }
                        load()
                    }
                }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            integrations = emptyList()
        } finally {
            loading = false
        }
    }

    fun changeProvider(key: String, enabled: Boolean) {
        val previous = providers.orEmpty()
        val wanted = if (enabled) previous + key else previous - key
        val next = MEAL_KIT_PROVIDERS.map { it.key }.filter { it in wanted }
        providers = next
        scope.launch {
            val ok = runCatching { Api.patch("/api/profile", mapOf("recipeProviders" to next)) }.isSuccess
            if (!ok) providers = previous
        }
    }

    LaunchedEffect(Unit) {
        launch {
            providers = runCatching {
                parseRecipeProviders((Api.get("/api/profile") as? JsonObject)?.get("user") as? JsonObject)
            }.getOrElse { emptyList() }
        }
        load()
    }

    val active = integrations.filter { it.settingsIsActive() }
    val inactive = integrations.filter { !it.settingsIsActive() }
    val popular = SETTINGS_INTEGRATIONS_POPULAR.flatMap { provider -> inactive.filter { it.provider == provider } }
    val apps = inactive.filter { it.provider !in SETTINGS_INTEGRATIONS_POPULAR }

    HcScreen(title = t.t("integrations.title"), contentPadding = SettingsPagePadding) {
        SettingsPage(gap = HcDimens.SpaceBlock) {
            HcText(t.t("integrations.intro"), HcTypeRoles.Small, Modifier.padding(horizontal = 4.dp), color = HcColors.TextSecondary)

            if (loading) {
                HcLoader()
            } else {
                val enabledKits = providers?.let { keys -> MEAL_KIT_PROVIDERS.filter { it.key in keys } }.orEmpty()
                val otherKits = providers?.let { keys -> MEAL_KIT_PROVIDERS.filter { it.key !in keys } }.orEmpty()
                fun kitCard(kit: MealKitProvider): @Composable () -> Unit = {
                    val enabled = providers?.contains(kit.key) == true
                    SettingsIntegrationsMealKitCard(kit, enabled, t) { changeProvider(kit.key, it) }
                }
                SettingsIntegrationsSection(
                    t.t("integrations.sections.active"),
                    active.map { item -> settingsIntegrationCardItem(item, t) { nav.push("/settings/integrations/${item.pageSlug}") } } +
                        enabledKits.map { kitCard(it) },
                )
                SettingsIntegrationsSection(
                    t.t("integrations.sections.popular"),
                    popular.map { item -> settingsIntegrationCardItem(item, t) { nav.push("/settings/integrations/${item.pageSlug}") } },
                )
                SettingsIntegrationsSection(
                    t.t("integrations.sections.recipes"),
                    otherKits.map { kitCard(it) },
                )
                SettingsIntegrationsSection(
                    t.t("integrations.sections.apps"),
                    apps.map { item -> settingsIntegrationCardItem(item, t) { nav.push("/settings/integrations/${item.pageSlug}") } },
                )
                SettingsIntegrationsSection(
                    t.t("integrations.sections.moveFrom"),
                    listOf<@Composable () -> Unit>({
                        SettingsIntegrationsCard(
                            title = t.t("integrations.moveFromTitle"),
                            description = t.t("integrations.moveFromDescription"),
                            active = false,
                            chevron = true,
                            onClick = { nav.push("/settings/import") },
                            icon = { SettingsIntegrationsGlyph("FileImport") },
                        )
                    }),
                )
            }
        }
    }
}

/**
 * A section heading followed by its cards, inside the .hf-page stack (the
 * heading gets 32 px above, 16 px below). Nothing when there are no cards.
 */
@Composable
private fun ColumnScope.SettingsIntegrationsSection(label: String, cards: List<@Composable () -> Unit>) {
    if (cards.isEmpty()) return
    HcSectionTitle(label, Modifier.padding(top = HcDimens.SpaceBlock))
    cards.forEach { it() }
}

private fun settingsIntegrationCardItem(item: SettingsIntegrationStatus, t: Translator, onOpen: () -> Unit): @Composable () -> Unit = {
    SettingsIntegrationsStatusCard(item, t, onOpen)
}

@Composable
private fun SettingsIntegrationsStatusCard(integration: SettingsIntegrationStatus, t: Translator, onOpen: () -> Unit) {
    val isOAuth = integration.kind == "oauth" && integration.slug != null
    val active = integration.settingsIsActive()
    val unavailable = integration.kind == "unavailable"
    val description = if (isOAuth && !integration.configured && !active) t.t("integrations.notConfigured") else integration.description

    SettingsIntegrationsCard(
        title = integration.label,
        description = description,
        active = active,
        dimmed = unavailable,
        chevron = !unavailable,
        // An integration awaiting a partner agreement has nothing to choose yet.
        onClick = if (unavailable) null else onOpen,
        icon = { SettingsIntegrationsLogo(integration.icon, integration.label, 36.dp) },
    ) {
        when {
            unavailable -> HcText(t.t("integrations.unavailable"), HcTypeRoles.Small, color = HcColors.TextSecondary)
            active -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                val synced = integration.lastSyncedAt
                if (synced != null) {
                    HcText(
                        t.t("integrations.lastSynced", "date" to settingsIntegrationFormatDateTime(synced)),
                        HcTypeRoles.Micro,
                        color = HcColors.TextSecondary,
                    )
                }
                val lastError = integration.lastError
                if (lastError != null) HcText(lastError, HcTypeRoles.Micro, color = HcColors.RedDark)
            }
            else -> SettingsIntegrationsFauxButton(
                when (integration.kind) {
                    "companion" -> t.t("integrations.manage")
                    "via" -> t.t("integrations.howTo")
                    else -> t.t("integrations.connect")
                },
            )
        }
    }
}

/** A meal-kit card (HelloFresh, RetNemt, BetterFeast) under "Opskrifter" with Slå til / Fjern. */
@Composable
private fun SettingsIntegrationsMealKitCard(kit: MealKitProvider, enabled: Boolean, t: Translator, onChange: (Boolean) -> Unit) {
    SettingsIntegrationsCard(
        title = t.t(kit.title),
        description = t.t(kit.description),
        active = enabled,
        icon = { SettingsIntegrationsGlyph("ChefHat") },
    ) {
        if (enabled) {
            HcText(
                t.t("integrations.remove"),
                HcTypeRoles.Small,
                Modifier.clickable { onChange(false) },
                color = HcColors.RedDark,
            )
        } else {
            HcButton(t.t("integrations.enable"), onClick = { onChange(true) })
        }
    }
}

/** The page's Card: tan, 16 px padding, icon + bold title (green dot when active) + description, optional chevron. */
@Composable
private fun SettingsIntegrationsCard(
    title: String,
    description: String,
    active: Boolean,
    icon: @Composable () -> Unit,
    dimmed: Boolean = false,
    chevron: Boolean = false,
    onClick: (() -> Unit)? = null,
    footer: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(
        Modifier
            .fillMaxWidth()
            .alpha(if (dimmed) 0.6f else 1f)
            .clip(shape)
            .background(HcColors.Tan, shape)
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            icon()
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (active) Box(Modifier.size(10.dp).clip(CircleShape).background(HcColors.Green))
                    HcText(title, HcTypeRoles.Body, color = HcColors.Black, bold = true)
                }
                HcText(description, HcTypeRoles.Small, color = HcColors.TextSecondary)
            }
            if (chevron) {
                HcIcon("ChevronRight", Modifier.padding(top = 4.dp).alpha(0.4f), size = 18.dp, color = HcColors.Black)
            }
        }
        footer?.invoke(this)
    }
}

/** 24 px Tabler icon in a 36 px slot (ChefHat, FileImport). */
@Composable
private fun SettingsIntegrationsGlyph(name: String) {
    Box(Modifier.padding(top = 4.dp).size(36.dp), contentAlignment = Alignment.Center) {
        HcIcon(name, size = 24.dp, color = HcColors.Black)
    }
}

/** src/components/IntegrationIcon.tsx — the logo, or a white tile with the first letter. */
@Composable
internal fun SettingsIntegrationsLogo(icon: String?, label: String, size: Dp, rounded: Boolean = true) {
    val shape = RoundedCornerShape(if (rounded) HcDimens.RadiusCard else 0.dp)
    if (icon != null) {
        HcRemoteImage(icon, Modifier.size(size).clip(shape), contentScale = ContentScale.Fit)
    } else {
        Box(Modifier.size(size).clip(shape).background(HcColors.White), contentAlignment = Alignment.Center) {
            HcText(label.take(1).uppercase(), HcTypeRoles.Body, color = HcColors.Black, bold = true, align = TextAlign.Center)
        }
    }
}

/** span.hf-btn-primary inside a linked card: looks like the primary button, the whole card is the tap target. */
@Composable
private fun SettingsIntegrationsFauxButton(label: String) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Box(
        Modifier.fillMaxWidth().clip(shape).background(HcColors.Action, shape).padding(vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        HcText(label, HcTypeRoles.Button, color = HcColors.White, align = TextAlign.Center)
    }
}

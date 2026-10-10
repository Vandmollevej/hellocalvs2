package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
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
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.api.NativeAuth
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcSheetSkipButton
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsAccessCategory
import dk.packroff.hellocal.ui.SettingsAccessFooter
import dk.packroff.hellocal.ui.SettingsAccessGroup
import dk.packroff.hellocal.ui.SettingsAccessRow
import dk.packroff.hellocal.ui.SettingsAccessSheet
import dk.packroff.hellocal.ui.SettingsAccessToggleGroup
import dk.packroff.hellocal.ui.SettingsAccessToggleRow
import dk.packroff.hellocal.ui.SettingsAccessTone
import dk.packroff.hellocal.ui.SettingsAccessTrailingButton
import dk.packroff.hellocal.ui.SettingsIntegrationsPremiumGate
import dk.packroff.hellocal.ui.SettingsIntegrationsTermsSheet
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull

// One page per integration (docs/DECISIONS.md 2026-09-26), shown as iOS'
// integration sheet (2026-09-27): the user switches each data type on/off —
// what Hello Cal writes to the app and what it reads — before connecting and
// at any time afterwards. Every choice is saved at once.

private const val SETTINGS_INTEGRATIONS_OVERVIEW = "/settings/integrations"

// Older device codes from before every card got its own (docs/DECISIONS.md 2026-09-24).
private const val SETTINGS_INTEGRATIONS_LEGACY_TOKEN_LABEL = "Companion-app"

/** The Health app's category (icon and colour) for each data type. */
private val SETTINGS_INTEGRATIONS_CATEGORY: Map<String, SettingsAccessCategory> = mapOf(
    "nutrition" to SettingsAccessCategory.Nutrition,
    "water" to SettingsAccessCategory.Nutrition,
    "weight" to SettingsAccessCategory.Body,
    "bodyFat" to SettingsAccessCategory.Body,
    "muscleMass" to SettingsAccessCategory.Body,
    "fatFreeMass" to SettingsAccessCategory.Body,
    "bodyWater" to SettingsAccessCategory.Body,
    "boneMass" to SettingsAccessCategory.Body,
    "visceralFat" to SettingsAccessCategory.Body,
    "body" to SettingsAccessCategory.Body,
    "activities" to SettingsAccessCategory.Activity,
    "steps" to SettingsAccessCategory.Activity,
    "energy" to SettingsAccessCategory.Activity,
    "heart" to SettingsAccessCategory.Heart,
    "sleep" to SettingsAccessCategory.Sleep,
)

/** src/components/hf/TesterPromoSheet.tsx testerPromoDismissKey() (localStorage on the web). */
private fun settingsTesterPromoDismissKey(pageSlug: String) = "hellocal.tester-promo.$pageSlug"

private class SettingsIntegrationsNotice(val text: String, val error: Boolean = false)

/** Native port of src/app/settings/integrations/[app]/page.tsx (inside its Seriøs-only layout). */
@Composable
fun SettingsIntegrationsAppScreen(args: RouteArgs) {
    SettingsIntegrationsPremiumGate(titleKey = "integrations.title") {
        SettingsIntegrationsAppContent(args)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun SettingsIntegrationsAppContent(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val app = args["app"]
    val connectedParam = args.opt("connected")
    val errorReason = args.opt("error")

    var integration by remember(app) { mutableStateOf<SettingsIntegrationStatus?>(null) }
    var loading by remember(app) { mutableStateOf(true) }
    var busy by remember(app) { mutableStateOf(false) }
    var saveError by remember(app) { mutableStateOf(false) }
    var tokens by remember(app) { mutableStateOf<List<SettingsIntegrationDeviceToken>>(emptyList()) }
    var newToken by remember(app) { mutableStateOf<String?>(null) }
    var testerOffer by remember(app) { mutableStateOf<SettingsIntegrationTesterOffer?>(null) }
    var showTesterPromo by remember(app) { mutableStateOf(false) }
    // Message at the top of the sheet after "Tillad" (2026-10-03: the sheet may
    // never just close without showing what happened). done = the button now says "Færdig".
    var feedback by remember(app) { mutableStateOf<SettingsIntegrationsNotice?>(null) }
    var done by remember(app) { mutableStateOf(false) }
    var autoSynced by remember(app) { mutableStateOf(false) }
    val newTokenRequester = remember { BringIntoViewRequester() }

    fun close() {
        // web: router.push("/settings/integrations"); natively we return to the overview instead of stacking it again.
        val previous = nav.stack.getOrNull(nav.stack.size - 2)
        if (previous?.path == SETTINGS_INTEGRATIONS_OVERVIEW) nav.back() else nav.replace(SETTINGS_INTEGRATIONS_OVERVIEW)
    }

    suspend fun loadTokens() {
        tokens = try {
            ApiJson.decodeFromJsonElement(SettingsIntegrationDeviceTokenList.serializer(), Api.get("/api/integrations/healthkit/tokens")).tokens
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            emptyList()
        }
    }

    // Fetches data now and says what came in.
    suspend fun sync(target: SettingsIntegrationStatus?, reload: suspend () -> Unit) {
        val slug = target?.slug ?: return
        val name = target.label
        busy = true
        feedback = SettingsIntegrationsNotice(t.t("integrations.feedback.syncing", "name" to name))
        try {
            feedback = try {
                val data = Api.post("/api/integrations/$slug/sync") as? JsonObject
                val skipped = (data?.get("skipped") as? JsonPrimitive)?.contentOrNull
                val delivered = (data?.get("delivered") as? JsonPrimitive)?.intOrNull ?: 0
                when {
                    skipped == "throttled" -> SettingsIntegrationsNotice(t.t("integrations.feedback.upToDate", "name" to name))
                    delivered > 0 -> SettingsIntegrationsNotice(t.t("integrations.feedback.synced", "name" to name, "count" to delivered.toString()))
                    else -> SettingsIntegrationsNotice(t.t("integrations.feedback.nothingNew", "name" to name))
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                val message = ((e as? ApiException)?.body as? JsonObject)?.get("message")?.let { (it as? JsonPrimitive)?.contentOrNull }
                SettingsIntegrationsNotice(message ?: t.t("integrations.feedback.syncFailed", "name" to name), error = true)
            }
            reload()
        } finally {
            busy = false
        }
    }

    suspend fun load() {
        try {
            val list = ApiJson.decodeFromJsonElement(SettingsIntegrationList.serializer(), Api.get("/api/integrations")).integrations
            val found = list.firstOrNull { it.pageSlug == app }
            integration = found
            // Right after connecting: fetch data at once so the user sees it.
            if (!autoSynced && found?.slug != null && found.status != "DISCONNECTED" && connectedParam != null) {
                autoSynced = true
                done = true
                scope.launch { sync(found) { load() } }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            integration = null
        } finally {
            loading = false
        }
    }

    // The tester programme (docs/DECISIONS.md 2026-10-02): the promo sheet shows
    // while the slot is free and the user has not closed it before.
    suspend fun loadTesterOffer() {
        try {
            val offer = ApiJson.decodeFromJsonElement(SettingsIntegrationTesterOffer.serializer(), Api.get("/api/integrations/$app/tester"))
            testerOffer = offer
            val dismissed = runCatching { NativeHooks.secureStorage.get(settingsTesterPromoDismissKey(app)) == "1" }.getOrDefault(false)
            showTesterPromo = offer.available && !dismissed
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            testerOffer = null
        }
    }

    // Also reloads when the app returns from the browser on the same page
    // (hellocal://settings/integrations/<app>?connected=1 replaces this screen).
    LaunchedEffect(app, connectedParam, errorReason) {
        launch { load() }
        launch { loadTokens() }
        launch { loadTesterOffer() }
    }

    LaunchedEffect(newToken) {
        if (newToken != null) runCatching { newTokenRequester.bringIntoView() }
    }

    fun saveSettings(settings: SettingsIntegrationSyncSettings) {
        val current = integration ?: return
        integration = current.copy(settings = settings)
        saveError = false
        scope.launch {
            try {
                val saved = ApiJson.decodeFromJsonElement(
                    SettingsIntegrationSettingsSaved.serializer(),
                    Api.put("/api/integrations/${current.pageSlug}/settings", mapOf("read" to settings.read, "write" to settings.write)),
                )
                integration = integration?.copy(settings = saved.settings, needsReconnect = saved.needsReconnect)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                integration = current
                saveError = true
            }
        }
    }

    fun connect() {
        val slug = integration?.slug ?: return
        // The system browser has no app session: fetch a one-time code bound to
        // this user first (POST /api/auth/native/connect-code). The provider's
        // callback returns to hellocal://settings/integrations/<app>?connected=1
        // (or ?error=…), docs/DECISIONS.md 2026-10-08 "Native login-overdragelse".
        busy = true
        scope.launch {
            try {
                NativeHooks.openExternalUrl(NativeAuth.integrationConnectUrl(slug))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                feedback = SettingsIntegrationsNotice(t.t("integrations.notice.failed", "name" to (integration?.label ?: slug)), error = true)
            } finally {
                busy = false
            }
        }
    }

    fun disconnect() {
        val slug = integration?.slug ?: return
        busy = true
        scope.launch {
            try {
                Api.post("/api/integrations/$slug/disconnect")
                close()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // web: the failed request is left unhandled; the sheet stays open.
            } finally {
                busy = false
            }
        }
    }

    suspend fun createToken() {
        val current = integration ?: return
        busy = true
        try {
            val response = Api.post("/api/integrations/healthkit/tokens", mapOf("label" to current.label)) as? JsonObject
            val token = (response?.get("token") as? JsonPrimitive)?.contentOrNull
            if (token != null) {
                newToken = token
                loadTokens()
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // web: only a successful response shows the code.
        } finally {
            busy = false
        }
    }

    fun revokeToken(id: String) {
        busy = true
        scope.launch {
            try {
                runCatching { Api.delete("/api/integrations/healthkit/tokens/$id") }
                loadTokens()
            } finally {
                busy = false
            }
        }
    }

    val current = integration
    if (loading || current == null) {
        SettingsAccessSheet(
            title = t.t("integrations.title"),
            message = if (loading) t.t("integrations.loading") else "—",
            allowLabel = t.t("integrations.access.allow"),
            denyLabel = t.t("integrations.access.deny"),
            allowDisabled = true,
            onAllow = ::close,
            onDeny = ::close,
            onDismiss = ::close,
            closeLabel = t.t("integrations.close"),
        )
        return
    }

    val name = current.label
    val isOAuth = current.kind == "oauth" && current.slug != null
    // Brands without an open API share via Health Connect/Apple Health (docs/DECISIONS.md 2026-10-02).
    val isVia = current.kind == "via"
    val hubs = current.via.orEmpty()
    fun hubName(hub: String) = t.t("integrations.hubs.$hub")
    fun hubPage(hub: String) = "/settings/integrations/" + hub.lowercase().replace("_", "-")
    val connected = current.status != "DISCONNECTED"
    // Connected with nothing missing: the sheet is a settings page, not a new
    // consent — "Forbundet" at the top, Færdig/Frakobl and no terms bar.
    val linked = isOAuth && connected && current.needsReconnect.isEmpty()
    val readTypes = current.capabilities.read
    val writeTypes = current.capabilities.write
    val settings = current.settings
    val cardTokens = tokens.filter { token ->
        token.label == name || (current.provider == "APPLE_HEALTH" && token.label == SETTINGS_INTEGRATIONS_LEGACY_TOKEN_LABEL)
    }
    val notice = feedback ?: when {
        connectedParam != null -> SettingsIntegrationsNotice(t.t("integrations.notice.connected", "name" to name))
        errorReason != null -> SettingsIntegrationsNotice(
            t.t(
                if (errorReason in listOf("config", "tier", "denied", "expired")) "integrations.notice.$errorReason" else "integrations.notice.failed",
                "name" to name,
            ),
            error = true,
        )
        else -> null
    }

    val hasTypes = readTypes.size + writeTypes.size > 0
    val allOn = readTypes.all { settings.read[it] == true } && writeTypes.all { settings.write[it] == true }
    val anyOn = readTypes.any { settings.read[it] == true } || writeTypes.any { settings.write[it] == true }

    fun toggleAll() {
        val value = !allOn
        saveSettings(
            SettingsIntegrationSyncSettings(
                read = readTypes.associateWith { value },
                write = writeTypes.associateWith { value },
            ),
        )
    }

    fun rows(direction: String, types: List<String>): List<SettingsAccessToggleRow> = types.map { type ->
        val source = if (direction == "read") settings.read else settings.write
        SettingsAccessToggleRow(
            key = type,
            label = t.t("integrations.access.$direction.$type"),
            category = SETTINGS_INTEGRATIONS_CATEGORY[type] ?: SettingsAccessCategory.Body,
            checked = source[type] == true,
            onChange = { value ->
                saveSettings(
                    if (direction == "read") settings.copy(read = settings.read + (type to value))
                    else settings.copy(write = settings.write + (type to value)),
                )
            },
        )
    }

    // "Tillad": connects (or reconnects) when access is missing; a connected app
    // fetches data now; a companion app without a device code gets one. The sheet
    // only closes once the user has seen the result and taps "Færdig".
    fun allow() {
        if (done || linked) return close()
        if (isVia && hubs.isNotEmpty()) return nav.push(hubPage(hubs[0]))
        if (isOAuth && (!connected || current.needsReconnect.isNotEmpty())) return connect()
        done = true
        if (isOAuth) {
            scope.launch { sync(current) { load() } }
            return
        }
        if (current.issuesDeviceTokens && cardTokens.isEmpty() && newToken == null) {
            feedback = SettingsIntegrationsNotice(t.t("integrations.feedback.deviceCode", "name" to name))
            scope.launch { createToken() }
            return
        }
        if (current.issuesDeviceTokens) {
            feedback = SettingsIntegrationsNotice(t.t("integrations.feedback.companionSaved", "name" to name))
            return
        }
        close()
    }

    // "Tillad ikke": a connected cloud app is disconnected; otherwise the sheet closes.
    fun deny() {
        if (isOAuth && connected) disconnect() else close()
    }

    val statusLine = listOfNotNull(
        t.t("integrations.status.${settingsIntegrationStatusKey(current)}"),
        current.lastSyncedAt?.let { t.t("integrations.lastSynced", "date" to settingsIntegrationFormatDateTime(it)) },
        current.lastPushedAt?.takeIf { writeTypes.isNotEmpty() }?.let { t.t("integrations.lastPushed", "date" to settingsIntegrationFormatDateTime(it)) },
    ).joinToString(" · ")

    SettingsAccessSheet(
        title = t.t("integrations.access.title", "name" to name),
        icon = { SettingsIntegrationsLogo(current.icon, name, 52.dp, rounded = false) },
        heading = name,
        message = if (linked) t.t("integrations.access.messageConnected", "name" to name)
        else t.t(if (writeTypes.isNotEmpty()) "integrations.access.messageReadWrite" else "integrations.access.messageRead", "name" to name),
        toggleAllLabel = if (hasTypes) t.t(if (allOn) "integrations.access.turnOffAll" else "integrations.access.turnOnAll") else null,
        onToggleAll = if (hasTypes) ::toggleAll else null,
        allowLabel = t.t(if (done || linked) "integrations.access.done" else "integrations.access.allow"),
        denyLabel = t.t(if (linked) "integrations.disconnect" else "integrations.access.deny"),
        allowDisabled = busy || (!done && !linked && ((hasTypes && !anyOn) || (isOAuth && !current.configured))),
        denyDisabled = busy,
        onAllow = ::allow,
        onDeny = ::deny,
        onDismiss = ::close,
        closeLabel = t.t("integrations.close"),
        terms = if (linked) null else ({ SettingsIntegrationsTermsSheet(paragraphs = settingsIntegrationTermsParagraphs(current.provider), href = SETTINGS_INTEGRATION_TERMS_HREF) }),
    ) {
        if (notice != null) SettingsAccessFooter(notice.text, error = notice.error)
        if (writeTypes.isNotEmpty()) SettingsAccessToggleGroup(t.t("integrations.access.writeTitle"), rows("write", writeTypes))
        if (readTypes.isNotEmpty()) SettingsAccessToggleGroup(t.t("integrations.access.readTitle"), rows("read", readTypes))

        if (hasTypes) {
            SettingsAccessFooter(
                t.t(if (writeTypes.isNotEmpty()) "integrations.access.explanationReadWrite" else "integrations.access.explanationRead", "name" to name),
            )
        }
        if (writeTypes.isEmpty() && readTypes.isNotEmpty()) SettingsAccessFooter(t.t("integrations.writeNone", "name" to name))
        if (saveError) SettingsAccessFooter(t.t("integrations.saveError"), error = true)
        val mine = testerOffer?.mine
        if (mine != null) {
            SettingsAccessFooter(
                t.t(if (mine == "APPROVED") "integrations.tester.approved" else "integrations.tester.pending", "points" to (testerOffer?.points ?: 0)),
            )
        }

        if (isVia) {
            val items = mutableListOf<@Composable () -> Unit>()
            if (current.status == "CONNECTED") items.add { SettingsAccessRow(statusLine) }
            hubs.forEach { hub ->
                items.add {
                    SettingsAccessRow(t.t("integrations.openHub", "hub" to hubName(hub)), tone = SettingsAccessTone.Action, onClick = { nav.push(hubPage(hub)) })
                }
            }
            SettingsAccessGroup(
                title = t.t("integrations.access.statusTitle"),
                items = items,
                footer = {
                    SettingsAccessFooter(
                        t.t(
                            "integrations.viaHowTo",
                            "name" to name,
                            "app" to (current.viaApp ?: name),
                            "hubs" to hubs.joinToString(t.t("integrations.hubsOr")) { hubName(it) },
                        ),
                    )
                    if (current.partnerPending) SettingsAccessFooter(t.t("integrations.partnerPending", "name" to name))
                },
            )
        } else {
            val items = mutableListOf<@Composable () -> Unit>({ SettingsAccessRow(statusLine) })
            if (isOAuth && connected) {
                items.add {
                    SettingsAccessRow(
                        if (busy) t.t("integrations.syncing") else t.t("integrations.syncNow"),
                        tone = SettingsAccessTone.Action,
                        onClick = { scope.launch { sync(integration) { load() } } },
                        enabled = !busy,
                    )
                }
                items.add {
                    SettingsAccessRow(t.t("integrations.disconnect"), tone = SettingsAccessTone.Danger, onClick = ::disconnect, enabled = !busy)
                }
            }
            SettingsAccessGroup(
                title = t.t("integrations.access.statusTitle"),
                items = items,
                footer = {
                    if (isOAuth && !current.configured && !connected) SettingsAccessFooter(t.t("integrations.notConfigured"))
                    if (isOAuth && connected && current.needsReconnect.isNotEmpty()) {
                        SettingsAccessFooter(t.t("integrations.needsReconnect", "name" to name))
                    }
                    val lastError = current.lastError
                    if (lastError != null) SettingsAccessFooter(lastError, error = true)
                },
            )
        }

        if (current.issuesDeviceTokens) {
            val items = mutableListOf<@Composable () -> Unit>()
            cardTokens.forEach { token ->
                items.add {
                    SettingsAccessRow(
                        t.t("integrations.createdAt", "date" to settingsIntegrationFormatDateTime(token.createdAt)) +
                            (token.lastUsedAt?.let { t.t("integrations.lastUsedAt", "date" to settingsIntegrationFormatDateTime(it)) } ?: ""),
                        trailing = {
                            SettingsAccessTrailingButton(
                                t.t("integrations.remove"),
                                onClick = { revokeToken(token.id) },
                                tone = SettingsAccessTone.Danger,
                                enabled = !busy,
                            )
                        },
                    )
                }
            }
            val shownToken = newToken
            if (shownToken != null) {
                items.add {
                    SettingsAccessRow(
                        t.t("integrations.saveTokenNotice"),
                        mono = shownToken,
                        modifier = Modifier.bringIntoViewRequester(newTokenRequester),
                        trailing = { SettingsAccessTrailingButton(t.t("integrations.close"), onClick = { newToken = null }) },
                    )
                }
            } else {
                items.add {
                    SettingsAccessRow(
                        t.t("integrations.generateDeviceCode"),
                        tone = SettingsAccessTone.Action,
                        onClick = { scope.launch { createToken() } },
                        enabled = !busy,
                    )
                }
            }
            SettingsAccessGroup(
                title = t.t("integrations.access.deviceTitle"),
                items = items,
                footer = { SettingsAccessFooter(t.t("integrations.companionHowTo")) },
            )
        }
    }

    val offer = testerOffer
    if (showTesterPromo && offer != null) {
        SettingsIntegrationsTesterPromoSheet(
            name = name,
            pageSlug = current.pageSlug,
            points = offer.points,
            onClose = { showTesterPromo = false },
            onSignedUp = { testerOffer = it },
        )
    }
}

/**
 * src/components/hf/TesterPromoSheet.tsx — "Bliv den første testperson … og
 * optjen 300 points" (docs/DECISIONS.md 2026-10-02). Shown only while the slot
 * is free; once closed it is not shown again for this integration on this device.
 */
@Composable
private fun SettingsIntegrationsTesterPromoSheet(
    name: String,
    pageSlug: String,
    points: Int,
    onClose: () -> Unit,
    onSignedUp: (SettingsIntegrationTesterOffer) -> Unit,
) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    // "offer" | "busy" | "signedUp" | "taken" | "error"
    var state by remember { mutableStateOf("offer") }

    fun close() {
        runCatching { NativeHooks.secureStorage.set(settingsTesterPromoDismissKey(pageSlug), "1") }
        onClose()
    }

    fun signUp() {
        state = "busy"
        scope.launch {
            state = try {
                val offer = ApiJson.decodeFromJsonElement(SettingsIntegrationTesterOffer.serializer(), Api.post("/api/integrations/$pageSlug/tester"))
                onSignedUp(offer)
                "signedUp"
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                if (e.status == 409) "taken" else "error"
            } catch (e: Exception) {
                "error"
            }
        }
    }

    val finished = state == "signedUp" || state == "taken"

    HcBottomSheet(
        onDismiss = ::close,
        title = t.t("integrations.tester.headline", "name" to name, "points" to points),
        footer = {
            if (finished) {
                // BottomSheetCloseButton className="hf-bottom-sheet__skip"
                HcSheetSkipButton(t.t("integrations.tester.close"))
            } else {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline)) {
                    HcText(
                        if (state == "busy") "…" else t.t("integrations.tester.signUp"),
                        HcTypeRoles.Body,
                        Modifier.clickable(enabled = state != "busy", onClick = ::signUp).alpha(if (state == "busy") 0.6f else 1f),
                        color = HcColors.Black,
                        bold = true,
                        underline = true,
                    )
                    HcText(
                        "* " + t.t("integrations.tester.terms"),
                        HcTypeRoles.Caption,
                        Modifier.clickable { nav.push("/betingelser#pointsystem") },
                    )
                }
            }
        },
    ) {
        Column(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            val shape = RoundedCornerShape(8.dp)
            Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Brand, shape).padding(16.dp)) {
                HcText("*" + t.t("integrations.tester.headline", "name" to name, "points" to points), HcTypeRoles.Body, color = HcColors.White, bold = true)
            }
            HcText(
                when (state) {
                    "signedUp" -> t.t("integrations.tester.signedUp", "name" to name, "points" to points)
                    "taken" -> t.t("integrations.tester.taken", "name" to name)
                    "error" -> t.t("integrations.tester.error")
                    else -> t.t("integrations.tester.body", "name" to name, "points" to points)
                },
                HcTypeRoles.Body,
            )
        }
    }
}

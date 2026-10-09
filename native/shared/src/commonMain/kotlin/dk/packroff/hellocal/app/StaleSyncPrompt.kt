package dk.packroff.hellocal.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.screens.settings.SettingsIntegrationList
import dk.packroff.hellocal.screens.settings.SettingsIntegrationStatus
import dk.packroff.hellocal.screens.settings.settingsIntegrationFormatDateTime
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcText
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant

private const val STALE_AFTER_MS = 3L * 24 * 60 * 60 * 1000
private const val SNOOZE_MS = 24L * 60 * 60 * 1000

/** Pages where the prompt never shows (src/components/StaleSyncPrompt.tsx SKIP_PREFIXES). */
private val SKIP_PREFIXES = listOf("/scan", "/settings/integrations", "/account/phone")

private fun snoozeKey(provider: String) = "stale-sync-snooze:$provider"

private fun snoozed(provider: String): Boolean =
    NativeHooks.secureStorage.get(snoozeKey(provider))?.toLongOrNull()?.let { it > Clock.System.now().toEpochMilliseconds() } == true

private fun lastSeen(i: SettingsIntegrationStatus): Long =
    (i.lastSyncedAt ?: i.connectedAt)?.let { runCatching { Instant.parse(it).toEpochMilliseconds() }.getOrNull() } ?: 0L

/** Checked once per app session, like the web's `checkedThisVisit`. */
private var checkedThisSession = false

/**
 * Native port of src/components/StaleSyncPrompt.tsx: a connected integration
 * (smart scale, watch, …) that has not synced for 3 days gets a bottom sheet
 * with "Sync now" (cloud integrations) or a link to its page. "Later" snoozes
 * that integration for a day.
 */
@Composable
fun StaleSyncPrompt(path: String) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var stale by remember { mutableStateOf<SettingsIntegrationStatus?>(null) }
    var busy by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }

    LaunchedEffect(path) {
        if (checkedThisSession || SKIP_PREFIXES.any { path == it || path.startsWith("$it/") }) return@LaunchedEffect
        checkedThisSession = true
        val list = runCatching {
            ApiJson.decodeFromJsonElement(SettingsIntegrationList.serializer(), Api.get("/api/integrations")).integrations
        }.getOrNull() ?: return@LaunchedEffect
        val now = Clock.System.now().toEpochMilliseconds()
        stale = list
            .filter { it.status != "DISCONNECTED" && it.connectedAt != null }
            .filter { now - lastSeen(it) > STALE_AFTER_MS && !snoozed(it.provider) }
            .minByOrNull { lastSeen(it) }
    }

    val current = stale ?: return
    val page = "/settings/integrations/${current.pageSlug}"
    val lastSync = current.lastSyncedAt?.let { settingsIntegrationFormatDateTime(it) } ?: t.t("staleSyncPrompt.never")

    HcBottomSheet(
        onDismiss = { stale = null },
        title = t.t("staleSyncPrompt.title", "name" to current.label),
    ) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HcText(t.t("staleSyncPrompt.body", "name" to current.label, "date" to lastSync), HcTypeRoles.Body)
            if (failed) HcText(t.t("staleSyncPrompt.failed"), HcTypeRoles.Small, color = HcColors.TextSecondary)
            if (current.slug != null) {
                HcButton(t.t("staleSyncPrompt.syncNow"), enabled = !busy, onClick = {
                    busy = true
                    failed = false
                    scope.launch {
                        val ok = runCatching { Api.post("/api/integrations/${current.slug}/sync") }.isSuccess
                        busy = false
                        if (ok) stale = null else failed = true
                    }
                })
                HcButton(t.t("staleSyncPrompt.open"), kind = HcButtonKind.Secondary, onClick = {
                    stale = null
                    nav.push(page)
                })
            } else {
                HcButton(t.t("staleSyncPrompt.open"), onClick = {
                    stale = null
                    nav.push(page)
                })
            }
            HcButton(t.t("staleSyncPrompt.later"), kind = HcButtonKind.Secondary, modifier = Modifier.padding(top = 4.dp), onClick = {
                NativeHooks.secureStorage.set(snoozeKey(current.provider), (Clock.System.now().toEpochMilliseconds() + SNOOZE_MS).toString())
                stale = null
            })
        }
    }
}

package dk.packroff.hellocal.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.screens.capture.SyncStatusItem
import dk.packroff.hellocal.screens.food.StaleSyncSheet
import dk.packroff.hellocal.screens.settings.SettingsIntegrationList
import dk.packroff.hellocal.screens.settings.SettingsIntegrationStatus
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
 * that integration for a day. Same sheet as the weigh-in prompt
 * (HomeWeighInPrompts), which owns integrations that deliver weight — those
 * are skipped here so the question never comes twice (2026-10-16).
 */
@Composable
fun StaleSyncPrompt(path: String) {
    var stale by remember { mutableStateOf<SettingsIntegrationStatus?>(null) }

    LaunchedEffect(path) {
        if (checkedThisSession || SKIP_PREFIXES.any { path == it || path.startsWith("$it/") }) return@LaunchedEffect
        checkedThisSession = true
        val list = runCatching {
            ApiJson.decodeFromJsonElement(SettingsIntegrationList.serializer(), Api.get("/api/integrations")).integrations
        }.getOrNull() ?: return@LaunchedEffect
        val now = Clock.System.now().toEpochMilliseconds()
        stale = list
            .filter { it.status != "DISCONNECTED" && it.connectedAt != null }
            .filter { "weight" !in it.capabilities.read }
            .filter { now - lastSeen(it) > STALE_AFTER_MS && !snoozed(it.provider) }
            .minByOrNull { lastSeen(it) }
    }

    val current = stale ?: return
    StaleSyncSheet(
        listOf(
            SyncStatusItem(
                provider = current.provider,
                label = current.label,
                icon = current.icon,
                slug = current.slug,
                pageSlug = current.pageSlug,
                canSyncNow = current.kind == "oauth",
                status = current.status,
                lastSyncedAt = current.lastSyncedAt,
                stale = true,
            ),
        ),
        onSynced = {},
        onClose = {
            NativeHooks.secureStorage.set(snoozeKey(current.provider), (Clock.System.now().toEpochMilliseconds() + SNOOZE_MS).toString())
            stale = null
        },
    )
}

package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.screens.capture.AttireToggles
import dk.packroff.hellocal.screens.capture.SyncStatusItem
import dk.packroff.hellocal.screens.capture.agoLabel
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.CaptureIntegrationIcon
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcSheetSkipButton
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalHcSheetClose
import dk.packroff.hellocal.ui.Units
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.daysUntil
import kotlinx.datetime.isoDayNumber
import kotlinx.serialization.Serializable
import kotlin.math.min

// src/components/weight/WeighInPrompts.tsx — two bottom sheets when the app
// opens (2026-10-07):
// 1) "Det er længe siden, der er synkroniseret" with Synk nu / link to the integration.
// 2) "Du har vejet dig i morges. Men var det: nøgen / med tøj / …" for every
//    smart-scale weigh-in whose attire is not confirmed (up to a week back).
// The "later" flags are the web's sessionStorage keys (HomeSessionFlags).

private const val SYNC_LATER_KEY = "hf-weight-sync-later"
private const val WEIGH_LATER_KEY = "hf-weigh-attire-later"

@Serializable
private data class WeighPendingSource(val label: String = "", val icon: String? = null)

@Serializable
private data class WeighPendingEntry(
    val id: String,
    val weightKg: Double,
    val weighedAt: String,
    val source: WeighPendingSource = WeighPendingSource(),
    val suggestion: String? = null,
)

@Serializable
private data class WeighPendingResponse(val pending: List<WeighPendingEntry> = emptyList())

@Serializable
private data class WeighSyncStatusResponse(val integrations: List<SyncStatusItem> = emptyList())

private suspend fun loadWeighPending(): List<WeighPendingEntry> = try {
    ApiJson.decodeFromJsonElement(WeighPendingResponse.serializer(), Api.get("/api/weight-attire/pending")).pending
} catch (e: Exception) {
    emptyList()
}

private suspend fun loadWeighSyncStatus(): List<SyncStatusItem> = try {
    ApiJson.decodeFromJsonElement(WeighSyncStatusResponse.serializer(), Api.get("/api/weight-sync-status")).integrations
} catch (e: Exception) {
    emptyList()
}

/** syncIntegrationNow — "Synk nu" for one integration. */
private suspend fun weighSyncIntegrationNow(slug: String): Boolean = try {
    Api.post("/api/integrations/$slug/sync")
    true
} catch (e: Exception) {
    false
}

@Composable
fun HomeWeighInPrompts() {
    val scope = rememberCoroutineScope()
    var stale by remember { mutableStateOf<List<SyncStatusItem>>(emptyList()) }
    var pending by remember { mutableStateOf<List<WeighPendingEntry>>(emptyList()) }
    var stage by remember { mutableStateOf("none") }

    LaunchedEffect(Unit) {
        val (syncItems, pendingList) = coroutineScope {
            val sync = async { loadWeighSyncStatus() }
            val list = async { loadWeighPending() }
            sync.await() to list.await()
        }
        val staleItems = syncItems.filter { it.stale }
        stale = staleItems
        pending = pendingList
        if (staleItems.isNotEmpty() && !HomeSessionFlags.has(SYNC_LATER_KEY)) stage = "sync"
        else if (pendingList.isNotEmpty() && !HomeSessionFlags.has(WEIGH_LATER_KEY)) stage = "weigh"
    }

    if (stage == "sync" && stale.isNotEmpty()) {
        StaleSyncSheet(
            stale,
            onSynced = { scope.launch { pending = loadWeighPending() } },
            onClose = {
                HomeSessionFlags.set(SYNC_LATER_KEY)
                stage = if (pending.isNotEmpty() && !HomeSessionFlags.has(WEIGH_LATER_KEY)) "weigh" else "none"
            },
        )
    } else if (stage == "weigh" && pending.isNotEmpty()) {
        PendingWeighInSheet(
            pending,
            onDone = { stage = "none" },
            onLater = {
                HomeSessionFlags.set(WEIGH_LATER_KEY)
                stage = "none"
            },
        )
    }
}

@Composable
private fun StaleSyncSheet(items: List<SyncStatusItem>, onSynced: () -> Unit, onClose: () -> Unit) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf("idle") }
    val first = items.first()
    val syncable = items.filter { it.canSyncNow && it.slug != null }
    val ago = first.lastSyncedAt?.let { agoLabel(it, t) }?.takeIf { it.isNotEmpty() }

    fun syncNow() {
        busy = true
        scope.launch {
            val results = syncable.map { item -> async { weighSyncIntegrationNow(item.slug ?: "") } }.awaitAll()
            busy = false
            val ok = results.all { it }
            result = if (ok) "ok" else "failed"
            if (ok) {
                NativeHooks.onRegistrationChanged()
                onSynced()
            }
        }
    }

    HcBottomSheet(
        onDismiss = onClose,
        title = t.t("weighIn.stale.title"),
        scrollable = true,
        footer = {
            val close = LocalHcSheetClose.current
            if (syncable.isNotEmpty() && result != "ok") {
                HcButton(if (busy) t.t("weighIn.sync.syncing") else t.t("weighIn.sync.now"), onClick = { syncNow() }, enabled = !busy)
            }
            if (result == "ok") HcButton(t.t("weighIn.continue"), onClick = close)
            else HcSheetSkipButton(t.t("weighIn.later"))
        },
    ) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            val shape = RoundedCornerShape(HcDimens.RadiusCard)
            Row(
                Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                CaptureIntegrationIcon(first.icon, first.label, 32.dp)
                HcText(
                    if (ago != null) t.t("weighIn.stale.body", "name" to first.label, "ago" to ago)
                    else t.t("weighIn.stale.bodyNever", "name" to first.label),
                    HcTypeRoles.Body,
                    Modifier.weight(1f),
                    color = HcColors.Black,
                )
            }
            if (result == "ok") {
                HcText(t.t("weighIn.sync.done"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.Green, bold = true, align = TextAlign.Center)
            }
            if (result == "failed") {
                HcText(t.t("weighIn.sync.failed"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center)
            }
            HcText(
                t.t("weighIn.sync.open", "name" to first.label),
                HcTypeRoles.Body,
                Modifier.fillMaxWidth().clickable { nav.push("/settings/integrations/${first.pageSlug}") },
                color = HcColors.Black,
                bold = true,
                align = TextAlign.Center,
            )
        }
    }
}

// ---------------------------------------------------------------------------
// src/lib/weigh-labels.ts + weigh-attire.ts (dayPartOf, daysAgo, weighWhen,
// capitalize): "i morges", "i går morges", "mandag morgen", "sidste uge
// tirsdag", otherwise the date.

private class WeighWhen(val label: String, val part: String, val today: Boolean)

private fun weighDayPartOf(hour: Int): String = when {
    hour in 5..11 -> "morning"
    hour in 12..17 -> "afternoon"
    hour >= 18 -> "evening"
    else -> "night"
}

private fun weighWhen(at: LocalDateTime, t: Translator, now: LocalDateTime = CaptureDates.nowLocal()): WeighWhen {
    val part = weighDayPartOf(at.hour)
    val ago = at.date.daysUntil(now.date)
    val sinceMonday = now.date.dayOfWeek.isoDayNumber - 1
    val weekday = HomeIntl.weekdayLong(at.date, t.locale)
    val label = when {
        ago <= 0 -> t.t("weighIn.when.today.$part")
        ago == 1 -> t.t("weighIn.when.yesterday.$part")
        // Same (Monday-based) week: "mandag morgen".
        ago <= sinceMonday -> t.t("weighIn.when.weekday", "weekday" to weekday, "part" to t.t("weighIn.when.part.$part"))
        ago <= sinceMonday + 7 -> t.t("weighIn.when.lastWeek", "weekday" to weekday)
        else -> CaptureDates.dayMonthLong(at.date, t.locale)
    }
    return WeighWhen(label, part, ago <= 0)
}

private fun weighCapitalize(text: String): String = if (text.isEmpty()) text else text.substring(0, 1).uppercase() + text.substring(1)

/** The round ‹ › buttons (size-10, disabled:opacity-25). */
@Composable
private fun WeighChevronButton(icon: String, label: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .size(40.dp)
            .alpha(if (enabled) 1f else 0.25f)
            .clip(CircleShape)
            .semantics { contentDescription = label }
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { HcIcon(icon, size = 24.dp, color = HcColors.Text) }
}

@Composable
private fun PendingWeighInSheet(entries: List<WeighPendingEntry>, onDone: () -> Unit, onLater: () -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val weightUnit = remember { Units.current().weight }
    var list by remember { mutableStateOf(entries) }
    // Oldest first; start at the newest.
    var index by remember { mutableStateOf(entries.size - 1) }
    var choices by remember { mutableStateOf(entries.associate { it.id to it.suggestion }) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }

    val entry = list[min(index, list.size - 1).coerceAtLeast(0)]
    val at = CaptureDates.local(entry.weighedAt) ?: CaptureDates.nowLocal()
    val whenInfo = weighWhen(at, t)
    val time = CaptureDates.time(at, t.locale)
    val heading = if (whenInfo.today && whenInfo.part == "morning") t.t("weighIn.prompt.todayMorning")
    else t.t("weighIn.prompt.past", "when" to whenInfo.label)

    fun save() {
        val attire = choices[entry.id] ?: return
        val id = entry.id
        saving = true
        error = false
        scope.launch {
            try {
                Api.patch("/api/weight-entries/$id", mapOf("attire" to attire))
                NativeHooks.onRegistrationChanged()
                val rest = list.filter { it.id != id }
                if (rest.isEmpty()) {
                    onDone()
                    return@launch
                }
                list = rest
                index = min(index, rest.size - 1)
            } catch (e: Exception) {
                error = true
            } finally {
                saving = false
            }
        }
    }

    HcBottomSheet(
        onDismiss = onLater,
        title = t.t("weighIn.prompt.aria"),
        scrollable = true,
        footer = {
            if (list.size > 1) {
                HcText("${index + 1}/${list.size}", HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
            HcButton(
                if (saving) t.t("weighIn.saving") else t.t("weighIn.save"),
                onClick = { save() },
                enabled = !saving && choices[entry.id] != null,
            )
            HcSheetSkipButton(t.t("weighIn.later"))
        },
    ) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (list.size > 1) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    WeighChevronButton("ChevronLeft", t.t("weighIn.prompt.older"), enabled = index > 0) { index -= 1 }
                    HcText(weighCapitalize(whenInfo.label), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                    WeighChevronButton("ChevronRight", t.t("weighIn.prompt.newer"), enabled = index < list.size - 1) { index += 1 }
                }
            }

            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                HcText(heading, HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.Black, align = TextAlign.Center)
                Text(
                    time,
                    Modifier.fillMaxWidth(),
                    style = HcTypeRoles.Title.style(HcColors.Black).copy(fontSize = 40.sp, lineHeight = 48.sp),
                    textAlign = TextAlign.Center,
                )
                Text(
                    buildAnnotatedString {
                        append(t.t("weighIn.prompt.andWeighed"))
                        append(" ")
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                            append(Units.formatWeight(entry.weightKg, weightUnit, Locale.Da))
                        }
                    },
                    Modifier.fillMaxWidth(),
                    style = HcTypeRoles.Body.style(HcColors.Black),
                    textAlign = TextAlign.Center,
                )
                HcText(t.t("weighIn.prompt.question"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(top = 8.dp), color = HcColors.Black, align = TextAlign.Center)
            }

            AttireToggles(choices[entry.id], { value -> choices = choices + (entry.id to value) })
            if (error) {
                HcText(t.t("weighIn.saveError"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center)
            }
        }
    }
}

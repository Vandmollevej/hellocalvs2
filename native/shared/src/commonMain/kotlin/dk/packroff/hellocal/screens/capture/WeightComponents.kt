package dk.packroff.hellocal.screens.capture

import dk.packroff.hellocal.ui.Units
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.CaptureIntegrationIcon
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.CapturePillButton
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcSheetSkipButton
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalHcSheetClose
import dk.packroff.hellocal.ui.VSpace
import dk.packroff.hellocal.ui.formatNumber
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.serialization.Serializable
import kotlin.math.max
import kotlin.math.roundToInt

/** src/lib/weigh-attire.ts ATTIRE_ITEMS */
internal val ATTIRE_ITEMS = listOf("UNDERWEAR", "PANTS", "TOP", "SWEATER", "SHOES", "POCKET_ITEMS", "AFTER_TOILET")

/** src/lib/weigh-attire.ts itemsFromAttire — older weigh-ins only have the single legacy choice. */
internal fun itemsFromAttire(attire: String?): List<String> = when (attire) {
    "UNDERWEAR" -> listOf("UNDERWEAR")
    "CLOTHED" -> listOf("UNDERWEAR", "PANTS", "TOP")
    "CLOTHED_PHONE" -> listOf("UNDERWEAR", "PANTS", "TOP", "POCKET_ITEMS")
    else -> emptyList()
}

/** src/components/weight/AttireToggles.tsx — one switch row per item, several can be on; none = naked. */
@Composable
internal fun AttireToggles(value: List<String>, onChange: (List<String>) -> Unit, enabled: Boolean = true) {
    val t = LocalTranslator.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ATTIRE_ITEMS.forEach { attire ->
            val on = attire in value
            val shape = RoundedCornerShape(12.dp)
            Row(
                Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clip(shape).background(HcColors.White, shape)
                    .alpha(if (enabled) 1f else 0.5f).clickable(enabled = enabled) { onChange(ATTIRE_ITEMS.filter { if (it == attire) !on else it in value }) }
                    .padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                HcText(t.t("weighIn.attireItem.$attire"), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                SmallSwitch(on)
            }
        }
        if (value.isEmpty()) HcText(t.t("weighIn.attireNaked"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
    }
}

/** The 44×24 switch drawn inside AttireToggles rows (display only; the row is the button). */
@Composable
private fun SmallSwitch(on: Boolean) {
    val x by animateDpAsState(if (on) 22.dp else 2.dp)
    Box(Modifier.size(44.dp, 24.dp).clip(RoundedCornerShape(50)).background(if (on) HcColors.Green else HcColors.TanDark)) {
        Box(Modifier.offset(x = x, y = 2.dp).size(20.dp).clip(RoundedCornerShape(50)).background(HcColors.White))
    }
}

@Serializable
internal data class SyncStatusItem(
    val provider: String,
    val label: String,
    val icon: String? = null,
    val slug: String? = null,
    val pageSlug: String = "",
    val canSyncNow: Boolean = false,
    val status: String = "",
    val lastSyncedAt: String? = null,
    val stale: Boolean = false,
)

@Serializable
private data class SyncStatusResponse(val integrations: List<SyncStatusItem> = emptyList())

/** src/lib/weigh-labels.ts agoLabel — "for 2 timer siden". */
internal fun agoLabel(fromIso: String, t: Translator): String {
    val from = CaptureDates.parseInstant(fromIso) ?: return ""
    val minutes = max(0, ((Clock.System.now().toEpochMilliseconds() - from.toEpochMilliseconds()) / 60_000.0).roundToInt())
    if (minutes < 2) return t.t("weighIn.ago.justNow")
    if (minutes < 60) return t.t("weighIn.ago.minutes", "n" to minutes)
    val hours = (minutes / 60.0).roundToInt()
    if (hours < 48) return t.t("weighIn.ago.hours", "n" to hours)
    return t.t("weighIn.ago.days", "n" to (hours / 24.0).roundToInt())
}

/** src/components/weight/WeightSyncStatus.tsx — connected integrations with "Synk nu". */
@Composable
internal fun WeightSyncStatus(onSynced: () -> Unit) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf<List<SyncStatusItem>?>(null) }
    var busy by remember { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf<String?>(null) }

    suspend fun load() {
        items = try {
            ApiJson.decodeFromJsonElement(SyncStatusResponse.serializer(), Api.get("/api/weight-sync-status")).integrations
        } catch (e: Exception) {
            emptyList()
        }
    }

    LaunchedEffect(Unit) { load() }

    val list = items ?: return
    if (list.isEmpty()) {
        HcCard(onClick = { nav.push("/settings/integrations") }) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                HcText(t.t("weighIn.sync.noneConnected"), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                HcText(t.t("weighIn.sync.connect"), HcTypeRoles.Small, bold = true, color = HcColors.Green)
            }
        }
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        list.forEach { item ->
            HcCard {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    CaptureIntegrationIcon(item.icon, item.label, 32.dp)
                    Column(Modifier.weight(1f)) {
                        HcText(item.label, HcTypeRoles.Body, bold = true, color = HcColors.Black)
                        val text = when {
                            failed == item.provider -> t.t("weighIn.sync.failed")
                            item.status == "ERROR" -> t.t("weighIn.sync.error")
                            item.lastSyncedAt != null -> t.t("weighIn.sync.last", "ago" to agoLabel(item.lastSyncedAt, t))
                            else -> t.t("weighIn.sync.never")
                        }
                        HcText(text, HcTypeRoles.Small, color = if (item.stale) HcColors.RedDark else HcColors.TextSecondary)
                    }
                    if (item.canSyncNow && item.slug != null) {
                        CapturePillButton(
                            if (busy == item.provider) t.t("weighIn.sync.syncing") else t.t("weighIn.sync.now"),
                            onClick = {
                                busy = item.provider
                                failed = null
                                scope.launch {
                                    val ok = runCatching { Api.post("/api/integrations/${item.slug}/sync") }.isSuccess
                                    if (!ok) failed = item.provider
                                    load()
                                    busy = null
                                    if (ok) onSynced()
                                }
                            },
                            enabled = busy == null,
                        )
                    } else {
                        HcText(
                            t.t("weighIn.sync.openShort"),
                            HcTypeRoles.Small,
                            Modifier.clickable { nav.push("/settings/integrations/${item.pageSlug}") },
                            bold = true,
                            color = HcColors.Green,
                        )
                    }
                }
            }
        }
    }
}

@Serializable
private data class WeightDetailEntry(val id: String, val weightKg: Double, val weighedAt: String, val source: String = "", val attire: String? = null, val attireItems: List<String> = emptyList())

@Serializable
private data class WeightDetailSource(val label: String, val icon: String? = null)

@Serializable
private data class WeightMetric(val type: String, val value: Double)

@Serializable
private data class WeightDetail(val entry: WeightDetailEntry, val source: WeightDetailSource? = null, val metrics: List<WeightMetric> = emptyList())

/** src/lib/body-metrics.ts BODY_METRIC_DISPLAY: type → (unit, decimals), in display order. */
private val BODY_METRIC_DISPLAY = listOf(
    Triple("BODY_FAT_PERCENT", "%", 1), Triple("FAT_MASS_KG", "kg", 1), Triple("FAT_FREE_MASS_KG", "kg", 1),
    Triple("MUSCLE_MASS_KG", "kg", 1), Triple("BONE_MASS_KG", "kg", 1), Triple("BODY_WATER_PERCENT", "%", 1),
    Triple("BODY_WATER_KG", "kg", 1), Triple("EXTRACELLULAR_WATER_KG", "kg", 1), Triple("INTRACELLULAR_WATER_KG", "kg", 1),
    Triple("VISCERAL_FAT_INDEX", "", 0), Triple("BMI", "", 1), Triple("BASAL_METABOLIC_RATE_KCAL", "kcal", 0),
    Triple("METABOLIC_AGE", "years", 0), Triple("METABOLIC_AGE_YEARS", "years", 0), Triple("VASCULAR_AGE_YEARS", "years", 0),
    Triple("SKIN_CONDUCTANCE_US", "µS", 1), Triple("SKELETAL_MUSCLE_MASS_KG", "kg", 1), Triple("PROTEIN_PERCENT", "%", 1),
    Triple("HEART_RATE_BPM", "bpm", 0), Triple("BLOOD_PRESSURE_SYSTOLIC_MMHG", "mmHg", 0), Triple("BLOOD_PRESSURE_DIASTOLIC_MMHG", "mmHg", 0),
    Triple("PULSE_WAVE_VELOCITY_M_S", "m/s", 1), Triple("VASCULAR_AGE", "years", 0), Triple("NERVE_HEALTH_SCORE", "", 0),
    Triple("ELECTROCHEMICAL_SKIN_CONDUCTANCE", "µS", 0), Triple("OXYGEN_SATURATION_PERCENT", "%", 0), Triple("TEMPERATURE_C", "°C", 1),
    Triple("SKIN_TEMPERATURE_C", "°C", 1), Triple("VO2_MAX", "", 1), Triple("HEIGHT_CM", "cm", 0),
)

/** src/components/weight/WeightEntryDetailsSheet.tsx — source, attire (editable) and smart-scale metrics. */
@Composable
internal fun WeightEntryDetailsSheet(id: String, onClose: () -> Unit, onChanged: () -> Unit = {}) {
    val t = LocalTranslator.current
    val unit = remember { Units.current().weight }
    val scope = rememberCoroutineScope()
    var detail by remember { mutableStateOf<WeightDetail?>(null) }
    var failed by remember { mutableStateOf(false) }
    var attire by remember { mutableStateOf<List<String>>(emptyList()) }
    var saving by remember { mutableStateOf(false) }

    LaunchedEffect(id) {
        try {
            val d = ApiJson.decodeFromJsonElement(WeightDetail.serializer(), Api.get("/api/weight-entries/$id"))
            detail = d
            attire = d.entry.attireItems.ifEmpty { itemsFromAttire(d.entry.attire) }
        } catch (e: Exception) {
            failed = true
        }
    }

    val d = detail
    val changed = d != null && (d.entry.attire == null || attire != d.entry.attireItems.ifEmpty { itemsFromAttire(d.entry.attire) })
    val metrics = if (d == null) emptyList() else BODY_METRIC_DISPLAY.mapNotNull { display -> d.metrics.firstOrNull { it.type == display.first }?.let { it to display } }

    HcBottomSheet(
        onDismiss = onClose,
        title = if (d != null) Units.formatWeight(d.entry.weightKg, unit, t.locale) else t.t("weighIn.details.title"),
        scrollable = true,
        footer = {
            val close = LocalHcSheetClose.current
            if (changed) {
                HcButton(if (saving) t.t("weighIn.saving") else t.t("weighIn.save"), onClick = {
                    val chosen = attire
                    saving = true
                    scope.launch {
                        try {
                            Api.patch("/api/weight-entries/$id", mapOf("attireItems" to chosen))
                            NativeHooks.onRegistrationChanged()
                            onChanged()
                        } catch (e: Exception) {
                        } finally {
                            saving = false
                        }
                    }
                    close()
                })
                HcSheetSkipButton(t.t("common.close"))
            } else {
                HcButton(t.t("common.close"), onClick = close)
            }
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CaptureDates.local(d?.entry?.weighedAt)?.let {
                HcText(CaptureDates.dayMonthLongTime(it, t.locale), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
            if (failed) HcText(t.t("weighIn.details.failed"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center)
            if (d == null && !failed) HcText(t.t("entrySheet.loading"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            if (d?.source != null) {
                val shape = RoundedCornerShape(HcDimens.RadiusCard)
                Row(
                    Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    CaptureIntegrationIcon(d.source.icon, d.source.label, 32.dp)
                    HcText(t.t("entrySheet.syncedFrom", "name" to d.source.label), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                }
            }
            if (d != null && d.source == null) {
                HcText(t.t("entrySheet.manual"), HcTypeRoles.Body, Modifier.fillMaxWidth(), bold = true, color = HcColors.Black, align = TextAlign.Center)
            }
            if (d != null) {
                HcText(t.t("weighIn.attireTitle"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                AttireToggles(attire, { attire = it })
            }
            if (metrics.isNotEmpty()) {
                val shape = RoundedCornerShape(HcDimens.RadiusCard)
                Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
                    metrics.forEachIndexed { index, (metric, display) ->
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            HcText(t.t("entrySheet.metrics.${metric.type}"), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                            val unitLabel = if (display.second == "years") t.t("entrySheet.years") else display.second
                            val number = formatNumber(metric.value, display.third, t.locale)
                            HcText(if (unitLabel.isNotEmpty()) "$number $unitLabel" else number, HcTypeRoles.Body, bold = true, color = HcColors.Black, align = TextAlign.End)
                        }
                        if (index < metrics.lastIndex) HcLine()
                    }
                }
            }
        }
    }
}

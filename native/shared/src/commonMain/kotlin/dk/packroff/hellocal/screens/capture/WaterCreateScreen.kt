package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CaptureBrandCard
import dk.packroff.hellocal.ui.CaptureCenteredError
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.CaptureFoodRow
import dk.packroff.hellocal.ui.CaptureFormCard
import dk.packroff.hellocal.ui.CaptureLine
import dk.packroff.hellocal.ui.CaptureMaskIcon
import dk.packroff.hellocal.ui.CaptureSlider
import dk.packroff.hellocal.ui.CaptureSuccess
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
internal data class WaterEntry(val id: String, val amountMl: Int, val loggedAt: String)

@Serializable
private data class WaterEntriesResponse(val entries: List<WaterEntry> = emptyList())

private const val MIN_ML = 0
private const val MAX_ML = 1000
private const val STEP_ML = 25

private class WaterContainer(val key: String, val ml: Int, val src: String, val boxHeight: Dp)

// Four presets that tap-select an ml amount; the slider stays freely adjustable.
private val CONTAINERS = listOf(
    WaterContainer("bottleLarge", 750, "/icons/water/bottle-large.png", 56.dp),
    WaterContainer("bottleSmall", 500, "/icons/water/bottle-small.png", 56.dp),
    WaterContainer("glassLarge", 330, "/icons/water/glass-large.png", 46.dp),
    WaterContainer("glassSmall", 250, "/icons/water/glass-small.png", 46.dp),
)

/** The water glass icon (src/components/icons/WaterGlass.tsx — PNG used as a mask). */
@Composable
internal fun WaterGlassIcon(size: Dp, color: androidx.compose.ui.graphics.Color = HcColors.Black) =
    CaptureMaskIcon("/icons/water-glass.png", size = size, color = color)

/** Native port of src/app/water/create/page.tsx. */
@Composable
fun WaterCreateScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var amountMl by remember { mutableStateOf(250) }
    var selectedKey by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(false) }
    var entries by remember { mutableStateOf<List<WaterEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(reload) {
        entries = try {
            ApiJson.decodeFromJsonElement(WaterEntriesResponse.serializer(), Api.get("/api/water-entries")).entries.take(5)
        } catch (e: Exception) {
            emptyList()
        }
        loading = false
    }

    fun submit() {
        if (amountMl <= 0) return
        saving = true
        saveError = null
        saved = false
        scope.launch {
            try {
                Api.post("/api/water-entries", mapOf("amountMl" to amountMl))
                saved = true
                selectedKey = null
                NativeHooks.onRegistrationChanged()
                reload++
            } catch (e: Exception) {
                saveError = t.t("waterLog.saveError")
            } finally {
                saving = false
            }
        }
    }

    HcScreen(title = t.t("waterLog.title"), contentPadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)) {
        Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
            CaptureBrandCard(t.t("waterLog.intro"))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                CONTAINERS.forEach { c ->
                    val selected = selectedKey == c.key
                    val shape = RoundedCornerShape(16.dp)
                    Column(
                        Modifier.weight(1f).aspectRatio(1f).clip(shape)
                            .background(if (selected) HcColors.SelectedBg else HcColors.Tan, shape)
                            .let { if (selected) it.border(2.dp, HcColors.SelectedBorder, shape) else it }
                            .clickable {
                                selectedKey = c.key
                                amountMl = c.ml
                                saved = false
                            },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
                    ) {
                        Box(Modifier.fillMaxWidth().height(56.dp), contentAlignment = Alignment.Center) {
                            HcRemoteImage(c.src, Modifier.height(c.boxHeight))
                        }
                        HcText("${c.ml / 10}cl", HcTypeRoles.Micro, bold = true, color = HcColors.Black)
                    }
                }
            }

            CaptureFormCard {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                    HcText(t.t("waterLog.amountLabel"), HcTypeRoles.Small, Modifier.weight(1f), bold = true, color = HcColors.Black)
                    HcText("$amountMl ml", HcTypeRoles.Title, color = HcColors.Black)
                }
                CaptureSlider(
                    value = amountMl,
                    min = MIN_ML,
                    max = maxOf(MAX_ML, amountMl),
                    step = STEP_ML,
                    onChange = {
                        amountMl = it
                        selectedKey = null
                        saved = false
                    },
                )
                CaptureCenteredError(saveError)
                if (saved && saveError == null) CaptureSuccess(t.t("waterLog.saved"))
                HcButton(
                    if (saving) t.t("waterLog.saving") else t.t("waterLog.add"),
                    onClick = ::submit,
                    enabled = !saving && amountMl > 0,
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!loading && entries.isNotEmpty()) {
                    HcText(t.t("waterLog.recentTitle"), HcTypeRoles.Caption, Modifier.padding(horizontal = 4.dp))
                }
                if (loading) HcLoader()
                if (!loading && entries.isEmpty()) {
                    HcText(t.t("waterLog.noEntriesYet"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                }
                if (entries.isNotEmpty()) {
                    Column {
                        groupWaterByDate(entries).forEach { group ->
                            HcSectionTitle(group.label)
                            group.entries.forEachIndexed { i, entry ->
                                val local = CaptureDates.local(entry.loggedAt)
                                CaptureFoodRow(
                                    title = "${entry.amountMl} ml",
                                    thumbnail = { WaterGlassIcon(22.dp) },
                                    right = {
                                        HcText(
                                            "${t.t("common.clockPrefix")} ${local?.let { CaptureDates.time(it) } ?: ""}",
                                            HcTypeRoles.Small,
                                            color = HcColors.TextSecondary,
                                        )
                                    },
                                )
                                if (i < group.entries.lastIndex) CaptureLine()
                            }
                        }
                    }
                }
            }
        }
    }
}

private class WaterGroup(val key: String, val label: String, val entries: MutableList<WaterEntry>)

// Newest first; entries from the same calendar day share one date separator.
private fun groupWaterByDate(entries: List<WaterEntry>): List<WaterGroup> {
    val sorted = entries.sortedByDescending { CaptureDates.parseInstant(it.loggedAt)?.toEpochMilliseconds() ?: 0L }
    val groups = mutableListOf<WaterGroup>()
    for (entry in sorted) {
        val date = CaptureDates.local(entry.loggedAt)?.date
        val key = date?.toString() ?: entry.loggedAt
        val last = groups.lastOrNull()
        if (last != null && last.key == key) last.entries += entry
        else groups += WaterGroup(key, date?.let { CaptureDates.dayMonthShort(it) } ?: "", mutableListOf(entry))
    }
    return groups
}

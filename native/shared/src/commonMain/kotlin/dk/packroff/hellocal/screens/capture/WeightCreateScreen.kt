package dk.packroff.hellocal.screens.capture

import dk.packroff.hellocal.ui.CalendarBathScaleIcon
import dk.packroff.hellocal.ui.Units
import dk.packroff.hellocal.ui.WeightUnit
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CaptureBrandCard
import dk.packroff.hellocal.ui.CaptureCenteredError
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.CaptureFormCard
import dk.packroff.hellocal.ui.CaptureSuccess
import dk.packroff.hellocal.ui.CaptureTanRow
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

@Serializable
private data class WeightEntry(val id: String, val weightKg: Double, val weighedAt: String)

@Serializable
private data class WeightEntriesResponse(val entries: List<WeightEntry> = emptyList())

/** Native port of src/app/weight/create/page.tsx. */
@Composable
fun WeightCreateScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val unit = remember { Units.current().weight }
    var weight by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(false) }
    var entries by remember { mutableStateOf<List<WeightEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var attire by remember { mutableStateOf<String?>(null) }
    var calibrated by remember { mutableStateOf(true) }
    var openId by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(reload) {
        entries = try {
            ApiJson.decodeFromJsonElement(WeightEntriesResponse.serializer(), Api.get("/api/weight-entries")).entries.take(5)
        } catch (e: Exception) {
            emptyList()
        }
        loading = false
    }

    LaunchedEffect(Unit) {
        // The admin algorithm guesses the attire from recent weigh-ins and the time of day.
        runCatching {
            (Api.get("/api/weight-attire/suggest") as? JsonObject)?.get("suggestion")?.jsonPrimitive?.contentOrNull
        }.getOrNull()?.let { attire = it }
        calibrated = runCatching {
            (Api.get("/api/weight-calibration") as? JsonObject)?.get("calibrated")?.jsonPrimitive?.booleanOrNull
        }.getOrNull() ?: true
    }

    fun submit() {
        val parsed = Units.parseWeightInput(weight, unit) ?: return
        saving = true
        saveError = null
        saved = false
        scope.launch {
            try {
                val body = buildMap<String, Any> {
                    put("weightKg", parsed)
                    attire?.let { put("attire", it) }
                }
                Api.post("/api/weight-entries", body)
                weight = ""
                saved = true
                NativeHooks.onRegistrationChanged()
                reload++
            } catch (e: Exception) {
                saveError = t.t("weightLog.saveError")
            } finally {
                saving = false
            }
        }
    }

    HcScreen(title = t.t("weightLog.title"), icon = { CalendarBathScaleIcon(20.dp, HcColors.White) }, contentPadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)) {
        Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
            CaptureBrandCard(t.t("weightLog.intro"))

            CaptureFormCard {
                HcTextField(
                    value = weight,
                    onValueChange = { weight = it },
                    label = "${t.t("weightLog.weightLabel")} (${Units.weightUnitLabel(unit)})",
                    placeholder = Units.weightToInputValue(78.4, unit),
                    keyboardType = if (unit == WeightUnit.St) KeyboardType.Text else KeyboardType.Decimal,
                    standard = true,
                )
                AttireToggles(attire, { attire = it })
                CaptureCenteredError(saveError)
                if (saved && saveError == null) CaptureSuccess(t.t("weightLog.saved"))
                HcButton(if (saving) t.t("weightLog.saving") else t.t("weightLog.save"), onClick = ::submit, enabled = !saving)
            }

            WeightSyncStatus(onSynced = { reload++ })

            if (!calibrated) {
                Row(
                    Modifier.fillMaxWidth().clickable { nav.push("/profile/weight-calibration") },
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    HcIcon("InfoCircle", size = 20.dp, color = HcColors.TextSecondary)
                    HcText(t.t("weightLog.moreDetailsLink"), HcTypeRoles.Small, bold = true, color = HcColors.TextSecondary)
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!loading && entries.isNotEmpty()) HcText(t.t("weightLog.recentTitle"), HcTypeRoles.Title, Modifier.padding(horizontal = 4.dp), color = HcColors.Black)
                if (loading) HcLoader()
                if (!loading && entries.isEmpty()) {
                    HcText(t.t("weightLog.noEntriesYet"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                }
                entries.forEach { entry ->
                    CaptureTanRow(onClick = { openId = entry.id }) {
                        HcText(Units.formatWeight(entry.weightKg, unit, t.locale), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                        CaptureDates.local(entry.weighedAt)?.let {
                            HcText(CaptureDates.dayMonthShortTime(it, t.locale), HcTypeRoles.Small, Modifier.padding(start = 8.dp), color = HcColors.TextSecondary)
                        }
                    }
                }
            }
        }
    }

    openId?.let { id -> WeightEntryDetailsSheet(id, onClose = { openId = null }, onChanged = { reload++ }) }
}

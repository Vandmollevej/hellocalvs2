package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.ui.text.style.TextAlign
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
import dk.packroff.hellocal.ui.CaptureDatePickerSheet
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.CaptureFormCard
import dk.packroff.hellocal.ui.CaptureSuccess
import dk.packroff.hellocal.ui.CaptureTanRow
import dk.packroff.hellocal.ui.CaptureValueField
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
import kotlinx.serialization.Serializable

@Serializable
private data class CycleEntry(val id: String, val startDate: String, val endDate: String? = null)

@Serializable
private data class CycleResponse(val entries: List<CycleEntry> = emptyList())

/**
 * Native port of src/app/period/create/page.tsx. Only reachable when sex = FEMALE
 * and cycle tracking is on; logs when a period started.
 */
@Composable
fun PeriodCreateScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var startDate by remember { mutableStateOf(CaptureDates.today()) }
    var picking by remember { mutableStateOf(false) }
    var entries by remember { mutableStateOf<List<CycleEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var saved by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(reload) {
        entries = try {
            ApiJson.decodeFromJsonElement(CycleResponse.serializer(), Api.get("/api/menstrual-cycle")).entries
        } catch (e: Exception) {
            emptyList()
        }
        loading = false
    }

    fun submit() {
        saving = true
        saveError = null
        saved = false
        scope.launch {
            try {
                Api.post("/api/menstrual-cycle", mapOf("startDate" to CaptureDates.isoDate(startDate)))
                saved = true
                NativeHooks.onRegistrationChanged()
                reload++
            } catch (e: Exception) {
                saveError = t.t("periodLog.saveError")
            } finally {
                saving = false
            }
        }
    }

    HcScreen(title = t.t("periodLog.title"), contentPadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)) {
        Column(verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
            CaptureBrandCard(t.t("periodLog.intro"))

            CaptureFormCard {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcText(t.t("periodLog.startDate").uppercase(), HcTypeRoles.Small, bold = true, color = HcColors.TextSecondary)
                    CaptureValueField(formatFullDate(startDate, t.locale), onClick = { picking = true }, background = HcColors.White)
                }
                CaptureCenteredError(saveError)
                if (saved && saveError == null) CaptureSuccess(t.t("periodLog.saved"))
                HcButton(if (saving) t.t("periodLog.saving") else t.t("periodLog.add"), onClick = ::submit, enabled = !saving)
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!loading && entries.isNotEmpty()) HcText(t.t("periodLog.recentTitle"), HcTypeRoles.Caption, Modifier.padding(horizontal = 4.dp))
                if (loading) HcLoader()
                if (!loading && entries.isEmpty()) {
                    HcText(t.t("periodLog.noEntriesYet"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                }
                entries.forEach { entry ->
                    CaptureTanRow {
                        val date = CaptureDates.parseDate(entry.startDate)
                        HcText(date?.let { formatFullDate(it, t.locale) } ?: entry.startDate, HcTypeRoles.Body, bold = true, color = HcColors.Black)
                    }
                }
            }
        }
    }

    if (picking) {
        CaptureDatePickerSheet(
            initial = startDate,
            max = CaptureDates.today(),
            onPick = {
                startDate = it
                saved = false
            },
            onDismiss = { picking = false },
            title = t.t("periodLog.startDate"),
        )
    }
}

/** "5. okt. 2026" (day numeric, month short, year numeric). */
private fun formatFullDate(date: LocalDate, locale: dk.packroff.hellocal.i18n.Locale) =
    CaptureDates.dayMonthShort(date, withYear = true, locale = locale)

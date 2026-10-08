package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.rememberDatePickerState
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
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcDivider
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.SettingsAccordionCard
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import dk.packroff.hellocal.ui.VSpace
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.datetime.plus
import kotlinx.datetime.toLocalDateTime
import kotlinx.datetime.todayIn
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Native port of src/app/settings/support/page.tsx (docs/DECISIONS.md
// 2026-09-23): the user decides which data Support may see, and for which
// period. All off by default; the period is enforced server-side.

/** SUPPORT_PERMISSION_KEYS from src/lib/support-permissions.ts (same order). */
internal val SettingsSupportPermissionKeys = listOf(
    "profile",
    "calendar",
    "foodIntake",
    "calories",
    "energyDistribution",
    "nutrients",
    "favorites",
    "recipes",
    "productSubmissions",
    "searchHistory",
    "weight",
    "bodyMeasurements",
    "activity",
    "steps",
    "heartAndHealthMetrics",
    "stress",
    "sleep",
    "water",
    "menstrualCycle",
    "goals",
    "statistics",
    "integrations",
    "messages",
    "subscription",
    "helloDoc",
)

private enum class SettingsSupportSaveStatus { Saved, Revoked }

private enum class SettingsSupportDateField { From, Until }

/** "YYYY-MM-DD" keys are compared as strings, exactly like the web. */
private fun settingsSupportDefaultPeriod(): Pair<String, String> {
    val today = Clock.System.todayIn(TimeZone.currentSystemDefault())
    return today.toString() to today.plus(7, DateTimeUnit.DAY).toString()
}

/** How <input type="date"> shows the value in Danish: dd.mm.åååå. */
private fun settingsSupportDisplayDate(key: String): String {
    val date = runCatching { LocalDate.parse(key) }.getOrNull() ?: return key
    return "${date.dayOfMonth.toString().padStart(2, '0')}.${date.monthNumber.toString().padStart(2, '0')}.${date.year}"
}

private fun settingsSupportKeyToUtcMillis(key: String): Long? =
    runCatching { LocalDate.parse(key).atStartOfDayIn(TimeZone.UTC).toEpochMilliseconds() }.getOrNull()

private fun settingsSupportUtcMillisToKey(millis: Long): String =
    Instant.fromEpochMilliseconds(millis).toLocalDateTime(TimeZone.UTC).date.toString()

/** readSupportPermissions(): unknown keys dropped, anything not literally true is off. */
private fun settingsSupportReadPermissions(value: Any?): Map<String, Boolean> {
    val obj = value as? JsonObject
    return SettingsSupportPermissionKeys.associateWith { key ->
        val p = obj?.get(key) as? JsonPrimitive
        p != null && !p.isString && p.booleanOrNull == true
    }
}

@Composable
fun SettingsSupportScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val defaults = remember { settingsSupportDefaultPeriod() }
    var validFrom by remember { mutableStateOf(defaults.first) }
    var validUntil by remember { mutableStateOf(defaults.second) }
    var permissions by remember { mutableStateOf(SettingsSupportPermissionKeys.associateWith { false }) }
    // "Menstruationscyklus" only exists for sex = FEMALE (docs/DECISIONS.md 2026-09-19).
    var isFemale by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf<SettingsSupportSaveStatus?>(null) }
    var pickingDate by remember { mutableStateOf<SettingsSupportDateField?>(null) }

    val visibleKeys = SettingsSupportPermissionKeys.filter { it != "menstrualCycle" || isFemale }

    LaunchedEffect(Unit) {
        launch {
            val sex = runCatching {
                Api.get("/api/profile").jsonObject["user"]?.jsonObject?.get("sex")?.jsonPrimitive?.contentOrNull
            }.getOrNull()
            isFemale = sex == "FEMALE"
        }
        try {
            val grant = Api.get("/api/support/access").jsonObject["grant"] as? JsonObject
            if (grant != null) {
                grant["validFrom"]?.jsonPrimitive?.contentOrNull?.let { validFrom = it }
                grant["validUntil"]?.jsonPrimitive?.contentOrNull?.let { validUntil = it }
                permissions = settingsSupportReadPermissions(grant["permissions"])
            }
        } catch (e: Exception) {
            error = t.t("settings.support.loadError")
        } finally {
            loading = false
        }
    }

    val allSelected = visibleKeys.all { permissions[it] == true }
    val anySelected = visibleKeys.any { permissions[it] == true }

    fun setAll(value: Boolean) {
        status = null
        permissions = permissions.toMutableMap().apply { visibleKeys.forEach { this[it] = value } }
    }

    fun setOne(key: String, value: Boolean) {
        status = null
        permissions = permissions.toMutableMap().apply { this[key] = value }
    }

    fun save() {
        error = null
        status = null
        if (validFrom.isEmpty() || validUntil.isEmpty()) {
            error = t.t("settings.support.dateRequired")
            return
        }
        if (validFrom > validUntil) {
            error = t.t("settings.support.invalidDateRange")
            return
        }
        saving = true
        scope.launch {
            try {
                // All off = revoke the current permission (kept as history server-side).
                if (anySelected) {
                    val visiblePermissions = visibleKeys.associateWith { permissions[it] == true }
                    Api.put(
                        "/api/support/access",
                        mapOf("validFrom" to validFrom, "validUntil" to validUntil, "permissions" to visiblePermissions),
                    )
                } else {
                    Api.delete("/api/support/access")
                }
                status = if (anySelected) SettingsSupportSaveStatus.Saved else SettingsSupportSaveStatus.Revoked
            } catch (e: ApiException) {
                val code = (e.body as? JsonObject)?.get("error")?.let { (it as? JsonPrimitive)?.contentOrNull }
                error = when (code) {
                    "UNTIL_IN_PAST" -> t.t("settings.support.untilInPast")
                    "INVALID_DATE_RANGE" -> t.t("settings.support.invalidDateRange")
                    else -> t.t("settings.support.saveError")
                }
            } catch (e: Exception) {
                error = t.t("settings.support.saveError")
            } finally {
                saving = false
            }
        }
    }

    HcScreen(title = t.t("settings.support.title"), contentPadding = SettingsPagePadding) {
        SettingsPage(gap = HcDimens.SpaceSection) {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                HcText(t.t("settings.support.intro"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                HcText(t.t("settings.support.description"), HcTypeRoles.Body, color = HcColors.TextSecondary)
            }

            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HcSectionTitle(t.t("settings.support.period"))
                VSpace(8.dp)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    SettingsSupportDateInput(
                        label = t.t("settings.support.from"),
                        value = validFrom,
                        onClick = { pickingDate = SettingsSupportDateField.From },
                        modifier = Modifier.weight(1f),
                    )
                    SettingsSupportDateInput(
                        label = t.t("settings.support.until"),
                        value = validUntil,
                        onClick = { pickingDate = SettingsSupportDateField.Until },
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HcSectionTitle(t.t("settings.support.dataTitle"))
                VSpace(8.dp)
                SettingsAccordionCard {
                    SettingsSupportPermissionRow(
                        label = t.t("settings.support.selectAll"),
                        checked = allSelected,
                        enabled = !loading,
                        onChange = ::setAll,
                        divider = true,
                    )
                    visibleKeys.forEachIndexed { index, key ->
                        SettingsSupportPermissionRow(
                            label = t.t("settings.support.permissions.$key"),
                            checked = permissions[key] == true,
                            enabled = !loading,
                            onChange = { value -> setOne(key, value) },
                            divider = index < visibleKeys.size - 1,
                        )
                    }
                }
            }

            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcError(error)
                status?.let {
                    HcText(
                        if (it == SettingsSupportSaveStatus.Saved) t.t("settings.support.saved") else t.t("settings.support.revoked"),
                        HcTypeRoles.Caption,
                    )
                }
                HcButton(
                    if (saving) t.t("settings.support.saving") else t.t("settings.support.saveAccess"),
                    onClick = ::save,
                    enabled = !saving && !loading,
                )
                // The help chat is only opened from here (docs/DECISIONS.md 2026-10-03).
                SettingsSupportHooks.openHelpChat?.let { openChat ->
                    HcButton(
                        t.t("settings.support.chat"),
                        onClick = openChat,
                        kind = HcButtonKind.Secondary,
                        leading = { HcIcon("MessageChatbot", size = 20.dp, stroke = 1.75f) },
                    )
                }
                HcButton(
                    t.t("settings.support.myRequests"),
                    onClick = { nav.push("/settings/support/requests") },
                    kind = HcButtonKind.Secondary,
                )
                // "Kontakt os" sits discreetly at the bottom — the chat should be tried first.
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    HcText(
                        t.t("settings.support.contact"),
                        HcTypeRoles.Body,
                        Modifier.clip(RoundedCornerShape(HcDimens.RadiusCard)).clickable { nav.push("/settings/support/contact") }.padding(4.dp),
                        bold = true,
                        color = HcColors.Action,
                    )
                }
            }
        }
    }

    if (SettingsSupportHooks.helpChatOpen) {
        SettingsHelpChatSheet(onClose = { SettingsSupportHooks.helpChatOpen = false })
    }

    when (pickingDate) {
        SettingsSupportDateField.From -> SettingsSupportDatePickerDialog(
            initial = validFrom,
            minKey = null,
            onDismiss = { pickingDate = null },
            onPicked = {
                status = null
                validFrom = it
                pickingDate = null
            },
        )
        SettingsSupportDateField.Until -> SettingsSupportDatePickerDialog(
            initial = validUntil,
            minKey = validFrom.ifEmpty { null },
            onDismiss = { pickingDate = null },
            onPicked = {
                status = null
                validUntil = it
                pickingDate = null
            },
        )
        null -> Unit
    }
}

/** <TextField variant="standard" type="date" label=…> — opens the system date picker. */
@Composable
private fun SettingsSupportDateInput(label: String, value: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        HcText(label, HcTypeRoles.Label)
        Box(
            Modifier
                .fillMaxWidth()
                .height(HcDimens.ControlHeight)
                .clip(shape)
                .background(HcColors.Page, shape)
                .border(1.dp, HcColors.FieldBorder, shape)
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp),
            contentAlignment = Alignment.CenterStart,
        ) {
            HcText(settingsSupportDisplayDate(value), HcTypeRoles.Input, maxLines = 1)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsSupportDatePickerDialog(
    initial: String,
    minKey: String?,
    onDismiss: () -> Unit,
    onPicked: (String) -> Unit,
) {
    val t = LocalTranslator.current
    val minMillis = minKey?.let { settingsSupportKeyToUtcMillis(it) }
    val state = rememberDatePickerState(
        initialSelectedDateMillis = settingsSupportKeyToUtcMillis(initial),
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long): Boolean = minMillis == null || utcTimeMillis >= minMillis
        },
    )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            // The browser's own date picker has no translated text; "OK" is the system label.
            HcText(
                "OK",
                HcTypeRoles.Button,
                Modifier.clip(RoundedCornerShape(HcDimens.RadiusCard)).clickable {
                    val millis = state.selectedDateMillis
                    if (millis != null) onPicked(settingsSupportUtcMillisToKey(millis)) else onDismiss()
                }.padding(12.dp),
            )
        },
        dismissButton = {
            HcText(
                t.t("common.cancel"),
                HcTypeRoles.Button,
                Modifier.clip(RoundedCornerShape(HcDimens.RadiusCard)).clickable(onClick = onDismiss).padding(12.dp),
            )
        },
    ) {
        DatePicker(state = state)
    }
}

/** PermissionRow — .hf-control-row with label and Toggle, tan-dark divider below. */
@Composable
private fun SettingsSupportPermissionRow(
    label: String,
    checked: Boolean,
    enabled: Boolean,
    onChange: (Boolean) -> Unit,
    divider: Boolean,
) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            HcText(label, HcTypeRoles.Body, Modifier.weight(1f), maxLines = 1)
            HcToggle(checked = checked, onChange = onChange, enabled = enabled)
        }
        if (divider) HcDivider()
    }
}

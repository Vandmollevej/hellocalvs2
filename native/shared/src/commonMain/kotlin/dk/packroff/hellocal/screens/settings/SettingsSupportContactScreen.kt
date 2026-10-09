package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
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
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcDivider
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Native port of src/app/settings/support/contact/page.tsx — "Kontakt os"
// (docs/DECISIONS.md 2026-09-23): an internal support request, not mailto:.
// Works without any data permission; if the user has an active Support
// permission, the server links it to the request.

/** SUPPORT_REQUEST_CATEGORIES from src/lib/support-permissions.ts. */
internal val SettingsSupportRequestCategories = listOf("ACCOUNT", "DATA", "PRODUCTS", "PAYMENT", "BUG", "OTHER")

private const val SETTINGS_SUPPORT_SUBJECT_MAX = 200
private const val SETTINGS_SUPPORT_MESSAGE_MAX = 5000

@Composable
fun SettingsSupportContactScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var category by remember { mutableStateOf("OTHER") }
    var subject by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var images by remember { mutableStateOf<List<String>>(emptyList()) }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var sentId by remember { mutableStateOf<String?>(null) }
    var choosingCategory by remember { mutableStateOf(false) }

    fun send() {
        error = null
        if (subject.isBlank() || message.isBlank()) {
            error = t.t("settings.support.contactRequired")
            return
        }
        sending = true
        scope.launch {
            try {
                val response = Api.post(
                    "/api/support/requests",
                    mapOf("category" to category, "subject" to subject, "message" to message, "attachments" to images),
                )
                val id = (response.jsonObject["request"] as? JsonObject)?.get("id")?.jsonPrimitive?.contentOrNull
                if (id == null) error = t.t("settings.support.contactError") else sentId = id
            } catch (e: Exception) {
                error = t.t("settings.support.contactError")
            } finally {
                sending = false
            }
        }
    }

    HcScreen(title = t.t("settings.support.contact"), contentPadding = SettingsPagePadding) {
        SettingsPage(gap = HcDimens.SpaceSection) {
            val sent = sentId
            if (sent != null) {
                HcText(t.t("settings.support.contactSent", "caseCode" to settingsSupportCaseCode(sent)), HcTypeRoles.Body)
                HcButton(t.t("settings.support.openCase"), onClick = { nav.push("/settings/support/requests/$sent") })
            } else {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    SettingsSupportCategorySelect(
                        label = t.t("settings.support.contactCategory"),
                        value = t.t("settings.support.categories.$category"),
                        onClick = { choosingCategory = true },
                    )
                    HcTextField(
                        value = subject,
                        onValueChange = { subject = it.take(SETTINGS_SUPPORT_SUBJECT_MAX) },
                        label = t.t("settings.support.contactSubject"),
                        standard = true,
                    )
                    SettingsSupportTextArea(
                        value = message,
                        onValueChange = { message = it },
                        label = t.t("settings.support.contactMessage"),
                        minLines = 6,
                        maxLength = SETTINGS_SUPPORT_MESSAGE_MAX,
                    )
                    SettingsSupportScreenshotPicker(images = images, onChange = { images = it }, disabled = sending)
                    HcError(error)
                    HcButton(
                        if (sending) t.t("settings.support.contactSending") else t.t("settings.support.contactSend"),
                        onClick = ::send,
                        enabled = !sending,
                    )
                }
            }
        }
    }

    // <select> → native list in a bottom sheet.
    if (choosingCategory) {
        HcBottomSheet(onDismiss = { choosingCategory = false }, title = t.t("settings.support.contactCategory")) {
            SettingsSupportRequestCategories.forEachIndexed { index, key ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = HcDimens.ControlHeight)
                        .clickable {
                            category = key
                            choosingCategory = false
                        }
                        .padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    HcText(t.t("settings.support.categories.$key"), HcTypeRoles.BodyLg, Modifier.weight(1f), bold = key == category)
                    if (key == category) HcIcon("Check", size = 20.dp, color = HcColors.Black)
                }
                if (index < SettingsSupportRequestCategories.size - 1) HcDivider()
            }
        }
    }
}

/** The styled <select> (hf-field, cream, field border, chevron-down on the right). */
@Composable
private fun SettingsSupportCategorySelect(label: String, value: String, onClick: () -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        HcText(label, HcTypeRoles.Label)
        Row(
            Modifier
                .fillMaxWidth()
                .height(HcDimens.ControlHeight)
                .clip(shape)
                .background(HcColors.Cream, shape)
                .border(1.dp, HcColors.FieldBorder, shape)
                .clickable(onClick = onClick)
                .padding(start = 16.dp, end = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            HcText(value, HcTypeRoles.Input, Modifier.weight(1f), maxLines = 1)
            HcIcon("ChevronDown", size = 18.dp, stroke = 2.5f, color = HcColors.Black)
        }
    }
}

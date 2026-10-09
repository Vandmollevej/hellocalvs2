package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.jsonObject

// Native port of src/app/settings/support/requests/[id]/page.tsx — one support
// request as a conversation (docs/DECISIONS.md 2026-09-26 "Support-indbakke").
// The user can reply; a resolved case is then reopened.

@Serializable
data class SupportThreadAttachmentDto(val id: String)

@Serializable
data class SupportThreadMessageDto(
    val id: String,
    val author: String = "USER",
    val body: String = "",
    val createdAt: String = "",
    val attachments: List<SupportThreadAttachmentDto> = emptyList(),
)

/** GET /api/support/requests/{id} → request (getUserSupportThread in src/lib/support-inbox.ts). */
@Serializable
data class SupportThreadDto(
    val id: String,
    val subject: String = "",
    val status: String = "OPEN",
    val awaitingReply: Boolean = false,
    val messages: List<SupportThreadMessageDto> = emptyList(),
)

@Composable
fun SettingsSupportRequestThreadScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val id = args["id"]
    var thread by remember { mutableStateOf<SupportThreadDto?>(null) }
    var loadError by remember { mutableStateOf(false) }
    var reply by remember { mutableStateOf("") }
    var images by remember { mutableStateOf<List<String>>(emptyList()) }
    var sending by remember { mutableStateOf(false) }
    var sendError by remember { mutableStateOf(false) }
    var openAttachment by remember { mutableStateOf<String?>(null) }

    suspend fun load() {
        try {
            val json = Api.get("/api/support/requests/$id").jsonObject["request"]
                ?: throw IllegalStateException("no request")
            thread = ApiJson.decodeFromJsonElement(SupportThreadDto.serializer(), json)
        } catch (e: Exception) {
            loadError = true
        }
    }

    LaunchedEffect(id) { load() }

    fun send() {
        if (reply.isBlank()) return
        sending = true
        sendError = false
        scope.launch {
            try {
                Api.post("/api/support/requests/$id", mapOf("message" to reply, "attachments" to images))
                reply = ""
                images = emptyList()
                load()
            } catch (e: Exception) {
                sendError = true
            } finally {
                sending = false
            }
        }
    }

    HcScreen(title = thread?.subject ?: t.t("settings.support.myRequests"), contentPadding = SettingsPagePadding) {
        SettingsPage(gap = HcDimens.SpaceBlock) {
            if (loadError) HcError(t.t("settings.support.requestsLoadError"))
            val current = thread
            if (current == null && !loadError) HcLoader()
            if (current != null) {
                HcText(
                    t.t("settings.support.caseLabel", "caseCode" to settingsSupportCaseCode(current.id)),
                    HcTypeRoles.Caption,
                    color = HcColors.TextSecondary,
                )
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    current.messages.forEach { message ->
                        SettingsSupportThreadBubble(message, onOpenAttachment = { openAttachment = it })
                    }
                }

                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (current.status == "RESOLVED") {
                        HcText(t.t("settings.support.replyReopens"), HcTypeRoles.Caption, color = HcColors.TextSecondary)
                    }
                    SettingsSupportTextArea(
                        value = reply,
                        onValueChange = { reply = it },
                        label = t.t("settings.support.replyLabel"),
                        minLines = 4,
                        maxLength = 5000,
                    )
                    SettingsSupportScreenshotPicker(images = images, onChange = { images = it }, disabled = sending)
                    if (sendError) HcError(t.t("settings.support.replyError"))
                    HcButton(
                        if (sending) t.t("settings.support.replySending") else t.t("settings.support.replySend"),
                        onClick = ::send,
                        enabled = !sending && reply.isNotBlank(),
                    )
                }
            }
        }
    }

    // Web opens the attachment in a new tab; natively it is shown full width in a sheet
    // (an external browser would not have the login cookie).
    openAttachment?.let { attachmentId ->
        HcBottomSheet(onDismiss = { openAttachment = null }) {
            SettingsSupportAttachmentImage(
                attachmentId,
                Modifier.fillMaxWidth().aspectRatio(0.75f).clip(RoundedCornerShape(HcDimens.RadiusCard)),
                contentScale = ContentScale.Fit,
            )
        }
    }
}

@Composable
private fun SettingsSupportThreadBubble(message: SupportThreadMessageDto, onOpenAttachment: (String) -> Unit) {
    val t = LocalTranslator.current
    val fromUser = message.author == "USER"
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(
        Modifier
            .fillMaxWidth()
            .padding(start = if (fromUser) 32.dp else 0.dp, end = if (fromUser) 0.dp else 32.dp)
            .clip(shape)
            .background(if (fromUser) HcColors.Tan else HcColors.GreenLight, shape)
            .padding(12.dp),
    ) {
        HcText(
            (if (fromUser) t.t("settings.support.threadYou") else t.t("settings.support.threadSupport")) +
                " · " + settingsSupportFormatDateTime(message.createdAt),
            HcTypeRoles.Caption,
            color = HcColors.TextSecondary,
        )
        HcText(message.body, HcTypeRoles.Body, Modifier.padding(top = 4.dp))
        if (message.attachments.isNotEmpty()) {
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                message.attachments.forEach { attachment ->
                    SettingsSupportAttachmentImage(
                        attachment.id,
                        Modifier
                            .size(80.dp)
                            .clip(shape)
                            .background(HcColors.Cream, shape)
                            .clickable { onOpenAttachment(attachment.id) },
                    )
                }
            }
        }
    }
}

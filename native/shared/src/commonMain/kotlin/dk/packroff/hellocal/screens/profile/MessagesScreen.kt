package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import dk.packroff.hellocal.ui.HcHtmlText
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalHcSheetClose
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import dk.packroff.hellocal.ui.ProfileSwipeToDelete
import dk.packroff.hellocal.ui.ProfileTextButton
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject

@Serializable
private data class InboxMessage(
    val id: String,
    val event: String = "",
    val subject: String? = null,
    val bodyHtml: String? = null,
    val createdAt: String,
    val readAt: String? = null,
)

/** Native port of src/app/profile/messages/page.tsx — the user's inbox with read/unread, delete and "Slettet". */
@Composable
fun MessagesScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var messages by remember { mutableStateOf<List<InboxMessage>?>(null) }
    var deletedView by remember { mutableStateOf(false) }
    var confirmClear by remember { mutableStateOf(false) }

    LaunchedEffect(deletedView) {
        runCatching {
            val list = (Api.get("/api/messages${if (deletedView) "?view=deleted" else ""}") as JsonObject)["messages"]!!
            ApiJson.decodeFromJsonElement(ListSerializer(InboxMessage.serializer()), list)
        }.getOrNull()?.let { messages = it }
    }

    fun now() = Clock.System.now().toString()

    fun markRead(id: String) {
        messages = messages?.map { if (it.id == id) it.copy(readAt = it.readAt ?: now()) else it }
        scope.launch { runCatching { Api.patch("/api/messages", mapOf("id" to id)) } }
    }

    fun markAllRead() {
        messages = messages?.map { it.copy(readAt = it.readAt ?: now()) }
        scope.launch { runCatching { Api.patch("/api/messages", mapOf("markAllRead" to true)) } }
    }

    fun deleteMessage(id: String) {
        messages = messages?.filter { it.id != id }
        scope.launch { runCatching { Api.patch("/api/messages", mapOf("id" to id, "delete" to true)) } }
    }

    fun clearAll() {
        messages = emptyList()
        scope.launch { runCatching { Api.delete("/api/messages") } }
    }

    val hasUnread = messages?.any { it.readAt == null } == true

    HcScreen(title = t.t("profile.messages.title"), contentPadding = ProfilePagePadding) {
        ProfilePage {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                ProfileTextButton(if (deletedView) t.t("profile.messages.title") else t.t("profile.messages.deleted"), onClick = {
                    messages = null
                    deletedView = !deletedView
                })
                if (deletedView) {
                    if (!messages.isNullOrEmpty()) ProfileTextButton(t.t("profile.messages.clearAll"), onClick = { confirmClear = true })
                } else if (hasUnread) {
                    ProfileTextButton(t.t("profile.messages.markAllRead"), onClick = ::markAllRead)
                }
            }
            val list = messages
            when {
                list == null -> HcLoader()
                list.isEmpty() -> HcText(
                    if (deletedView) t.t("profile.messages.emptyDeleted") else t.t("profile.messages.empty"),
                    HcTypeRoles.Body,
                    color = HcColors.TextSecondary,
                )
                else -> list.forEach { message ->
                    key(message.id) {
                        val card = @Composable {
                            val shape = RoundedCornerShape(HcDimens.RadiusCard)
                            Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).clickable { markRead(message.id) }.padding(16.dp)) {
                                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    HcText(message.subject ?: "", HcTypeRoles.Body, Modifier.weight(1f))
                                    if (message.readAt == null) HcText(t.t("profile.messages.unread"), HcTypeRoles.Caption, color = HcColors.TextSecondary)
                                }
                                if (!message.bodyHtml.isNullOrEmpty()) {
                                    // dangerouslySetInnerHTML in "text-text-secondary hf-type-caption": Tailwind preflight
                                    // look — links inherit the colour without underline, lists without bullets.
                                    HcHtmlText(
                                        message.bodyHtml,
                                        HcTypeRoles.Caption,
                                        Modifier.padding(top = 8.dp),
                                        color = HcColors.TextSecondary,
                                        linkUnderline = false,
                                        listMarkers = false,
                                    )
                                }
                                HcText(ProfileDates.dateTime(message.createdAt), HcTypeRoles.Caption, Modifier.padding(top = 8.dp), color = HcColors.TextSecondary)
                            }
                        }
                        if (deletedView) card() else ProfileSwipeToDelete(t.t("profile.messages.delete"), onDelete = { deleteMessage(message.id) }) { card() }
                    }
                }
            }
        }
    }

    if (confirmClear) {
        HcBottomSheet(onDismiss = { confirmClear = false }, title = t.t("profile.messages.clearAll")) {
            val closeSheet = LocalHcSheetClose.current
            Column(Modifier.padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                HcText(t.t("profile.messages.clearAllWarning"), HcTypeRoles.Body)
                // BottomSheetCloseButton: runs clearAll, then closes the sheet with its animation.
                HcButton(t.t("profile.messages.clearAll"), onClick = {
                    clearAll()
                    closeSheet()
                })
            }
        }
    }
}

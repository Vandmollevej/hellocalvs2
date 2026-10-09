package dk.packroff.hellocal.screens.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.CaptureDetailRow
import dk.packroff.hellocal.ui.CaptureEntryDetailsSheet
import dk.packroff.hellocal.ui.CaptureFilledField
import dk.packroff.hellocal.ui.HcLine
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.roundToInt

private const val CHAT_ITEMS_STORAGE_KEY = "hf-chat-added-items"

@Serializable
private data class PersistedChatItems(val date: String, val items: List<VoiceItem>)

private fun chatTodayKey() = CaptureDates.isoDate(CaptureDates.today())

private fun loadChatItems(): List<VoiceItem> {
    val raw = NativeHooks.secureStorage.get(CHAT_ITEMS_STORAGE_KEY) ?: return emptyList()
    val parsed = runCatching { ApiJson.decodeFromString(PersistedChatItems.serializer(), raw) }.getOrNull() ?: return emptyList()
    if (parsed.date != chatTodayKey()) {
        NativeHooks.secureStorage.set(CHAT_ITEMS_STORAGE_KEY, null)
        return emptyList()
    }
    return parsed.items
}

private fun persistChat(items: List<VoiceItem>) {
    val saved = items.filter { it.saved }
    NativeHooks.secureStorage.set(
        CHAT_ITEMS_STORAGE_KEY,
        if (saved.isEmpty()) null else ApiJson.encodeToString(PersistedChatItems.serializer(), PersistedChatItems(chatTodayKey(), saved)),
    )
}

private var chatStamp = 0

/**
 * Native port of src/app/chat/page.tsx — "Indtast": the meal is typed instead
 * of spoken and interpreted by the same endpoint as the voice page.
 */
@Composable
fun ChatScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val lang = rememberMealInputLanguage()
    var items by remember { mutableStateOf(loadChatItems()) }
    var text by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var isAdding by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var confirmDelete by remember { mutableStateOf<VoiceItem?>(null) }

    fun updateItems(next: List<VoiceItem>) {
        items = next
        persistChat(next)
    }

    fun send() {
        val value = text.trim()
        if (value.isEmpty() || busy) return
        busy = true
        errorMessage = null
        scope.launch {
            try {
                val data = ApiJson.decodeFromJsonElement(
                    InterpretedResponse.serializer(),
                    Api.post("/api/ai/interpret-meal", mapOf("transcript" to value, "language" to lang.language)),
                )
                if (data.items.isEmpty()) {
                    errorMessage = t.t("web.chatNothing")
                } else {
                    val stamp = chatStamp++
                    updateItems(items + data.items.mapIndexed { index, item -> VoiceItem("pending-$stamp-$index", item, saved = false) })
                    text = ""
                }
            } catch (e: Exception) {
                errorMessage = t.t("web.chatError")
            } finally {
                busy = false
            }
        }
    }

    // Adds either all shown suggestions or just the one row (ids).
    fun addShownItems(ids: List<String>? = null) {
        val pending = items.filter { !it.saved && (ids == null || it.id in ids) }
        if (pending.isEmpty() || isAdding) return
        isAdding = true
        errorMessage = null
        scope.launch {
            val results = coroutineScope {
                pending.map { entry ->
                    async {
                        runCatching {
                            val res = Api.post("/api/registrations", registrationBody(entry.item)).jsonObject
                            val id = res["registration"]?.jsonObject?.get("id")?.jsonPrimitive?.contentOrNull ?: return@runCatching null
                            entry.id to entry.copy(id = id, saved = true)
                        }.getOrNull()
                    }
                }.awaitAll()
            }
            // Items that could not be saved stay as suggestions so they can be retried.
            val savedByPendingId = results.filterNotNull().toMap()
            updateItems(items.map { savedByPendingId[it.id] ?: it })
            isAdding = false
            if (savedByPendingId.isNotEmpty()) NativeHooks.onRegistrationChanged()
            if (savedByPendingId.size < pending.size) errorMessage = t.t("web.chatSaveError")
        }
    }

    fun deleteItem(entry: VoiceItem) {
        if (entry.saved) {
            confirmDelete = entry
            return
        }
        updateItems(items.filter { it.id != entry.id })
    }

    fun deleteSaved(entry: VoiceItem) {
        updateItems(items.filter { it.id != entry.id })
        scope.launch {
            runCatching { Api.delete("/api/registrations/${entry.id}") }
            NativeHooks.onRegistrationChanged()
        }
    }

    val suggested = items.filter { !it.saved }
    val saved = items.filter { it.saved }

    Column(Modifier.fillMaxSize()) {
        HcAppBar(
            title = t.t("web.chatTitle"),
            back = false,
            leading = { MealLanguagePicker(lang.language, lang.region) { lang.set(it) } },
        )
        Box(Modifier.weight(1f)) {
            HcScreen(title = null) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                    val shape = RoundedCornerShape(HcDimens.RadiusCard)
                    Box(Modifier.weight(1f).clip(shape).border(1.dp, HcColors.FieldBorder, shape)) {
                        CaptureFilledField(text, { text = it }, placeholder = t.t("web.chatIntro"), background = HcColors.White, singleLine = false, minHeight = 72.dp)
                    }
                    val enabled = !busy && text.isNotBlank()
                    Box(
                        Modifier.size(48.dp).clip(shape).background(if (enabled) HcColors.Action else HcColors.Disabled, shape)
                            .clickable(enabled = enabled) { send() },
                        contentAlignment = Alignment.Center,
                    ) {
                        HcIcon("Send", size = 20.dp, stroke = 1.6f, color = HcColors.White)
                    }
                }
                if (busy) HcText(t.t("web.chatThinking"), HcTypeRoles.Small, Modifier.padding(top = 8.dp), color = HcColors.TextSecondary)
                errorMessage?.let { HcText(it, HcTypeRoles.Small, Modifier.padding(top = 8.dp), color = HcColors.RedDark) }

                if (suggested.isNotEmpty()) {
                    Column(Modifier.padding(top = 16.dp)) {
                        HcText(t.t("web.chatSuggested"), HcTypeRoles.Body, Modifier.padding(bottom = 4.dp), bold = true, color = HcColors.Black)
                        suggested.forEachIndexed { index, entry ->
                            VoiceItemRow(
                                entry,
                                onFavorite = null,
                                onReportError = null,
                                onDelete = { deleteItem(entry) },
                                onAdd = { addShownItems(listOf(entry.id)) },
                                adding = isAdding,
                                addLabel = t.t("web.chatAdd"),
                            )
                            if (index < suggested.lastIndex) HcLine()
                        }
                        if (suggested.size > 1) {
                            HcButton(
                                if (isAdding) t.t("voice.adding") else t.t("web.chatAddAll"),
                                onClick = { addShownItems() },
                                modifier = Modifier.padding(top = 16.dp),
                                enabled = !isAdding,
                            )
                        }
                    }
                }

                if (saved.isNotEmpty()) {
                    Column(Modifier.padding(top = 16.dp)) {
                        HcText(t.t("voice.added"), HcTypeRoles.Body, Modifier.padding(bottom = 4.dp), bold = true, color = HcColors.Black)
                        saved.forEachIndexed { index, entry ->
                            VoiceItemRow(
                                entry,
                                onFavorite = null,
                                onReportError = null,
                                onDelete = { deleteItem(entry) },
                                onOpen = { nav.push("/registration/${entry.id}") },
                            )
                            if (index < saved.lastIndex) HcLine()
                        }
                    }
                }
            }
        }
    }

    confirmDelete?.let { entry ->
        CaptureEntryDetailsSheet(
            title = entry.item.title,
            rows = listOf(
                CaptureDetailRow(t.t("entrySheet.amount"), entry.item.amountLabel.ifEmpty { "${entry.item.amountGrams.roundToInt()} g" }),
                CaptureDetailRow(t.t("entrySheet.energy"), "${entry.item.kcal.roundToInt()} kcal"),
            ),
            onDelete = { deleteSaved(entry) },
            onClose = { confirmDelete = null },
        )
    }
}

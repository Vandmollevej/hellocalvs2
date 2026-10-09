package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.api.HelloCalConfig
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcSheetSize
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileTextArea
import dk.packroff.hellocal.ui.ProfileTextButton
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

// Native port of src/components/help/HelpChat.tsx — the help chat
// (docs/DECISIONS.md 2026-10-02): AI chatbot with shortcuts to a person and
// the contact form (no phone support). Opened only from the Support page
// (SettingsSupportHooks.openHelpChat). All logic (AI, categories, hand-over)
// lives on the server behind /api/chatbot and /api/chatbot/escalate.

@Serializable
data class SettingsHelpChatMessageDto(
    val id: String,
    val role: String = "ASSISTANT",
    val body: String = "",
    val links: List<String> = emptyList(),
    val needsHuman: Boolean = false,
)

@Serializable
data class SettingsHelpChatConversationDto(
    val id: String,
    val escalated: Boolean = false,
    val supportRequestId: String? = null,
    val caseCode: String? = null,
    val messages: List<SettingsHelpChatMessageDto> = emptyList(),
)

private val SETTINGS_HELP_CHAT_SUGGESTIONS = listOf("helpChat.suggestion1", "helpChat.suggestion2", "helpChat.suggestion3", "helpChat.suggestion4")

/** The app is the "APP" channel (web: narrower than 1024 px). */
private const val SETTINGS_HELP_CHAT_CHANNEL = "APP"

/** CHATBOT_LINKS in src/lib/chatbot-knowledge.ts — the only addresses the chatbot may send (da, en). */
private val SETTINGS_HELP_CHAT_LINKS: Map<String, Pair<String, String>> = mapOf(
    "/profile/goals" to ("Gå til Mål" to "Go to Goals"),
    "/settings" to ("Gå til Indstillinger" to "Go to Settings"),
    "/search" to ("Søg efter en madvare" to "Search for a food"),
    "/camera?mode=product" to ("Åbn kameraet" to "Open the camera"),
    "/voice" to ("Åbn mikrofonen" to "Open the microphone"),
    "/camera/create" to ("Opret en vare" to "Create a product"),
    "/calendar" to ("Gå til Kalender" to "Go to Calendar"),
    "/create-dish" to ("Opret en ret" to "Create a dish"),
    "/profile/recipes" to ("Gå til Retter" to "Go to Dishes"),
    "/weight/create" to ("Registrér vægt" to "Log weight"),
    "/water/create" to ("Registrér vand" to "Log water"),
    "/profile/body-measurements" to ("Gå til Kropsmål" to "Go to Body measurements"),
    "/statistics" to ("Gå til Statistik" to "Go to Statistics"),
    "/settings/display/front-page" to ("Tilpas forsiden" to "Customise the front page"),
    "/forgot-password" to ("Nulstil adgangskode" to "Reset password"),
    "/profile/change-password" to ("Skift adgangskode" to "Change password"),
    "/profile/edit" to ("Gå til Rediger profil" to "Go to Edit profile"),
    "/profile/settings/language-region" to ("Gå til Sprog og region" to "Go to Language and region"),
    "/profile/notifications" to ("Gå til Notifikationer" to "Go to Notifications"),
    "/profile/subscription" to ("Gå til Abonnement" to "Go to Subscription"),
    "/settings/payment" to ("Gå til Betaling" to "Go to Payment"),
    "/privatlivspolitik" to ("Læs privatlivspolitikken" to "Read the privacy policy"),
    "/settings/hello-doc" to ("Gå til Hello Doc" to "Go to Hello Doc"),
    "/settings/support" to ("Gå til Support" to "Go to Support"),
    "/settings/integrations" to ("Gå til Integrationer" to "Go to Integrations"),
    "/profile/report-bug" to ("Meld en fejl" to "Report a bug"),
    "/settings/support/contact" to ("Kontakt os" to "Contact us"),
    "/profile/family" to ("Gå til Familie" to "Go to Family"),
    "/hjaelp.html" to ("Åbn Hjælpecentret" to "Open the Help centre"),
)

/**
 * HELP_GUIDES in src/lib/help-guides.ts: guide id → the page the guide ends on.
 * Links are stored as "guide:<id>".
 */
private val SETTINGS_HELP_CHAT_GUIDES: Map<String, String> = mapOf(
    "log-weight" to "/weight/create",
    "log-water" to "/water/create",
    "scan-barcode" to "/camera?mode=product",
    "voice-log" to "/voice",
    "search-food" to "/search",
    "create-dish" to "/create-dish",
    "body-measurements" to "/profile/body-measurements",
    "goals" to "/profile/goals",
    "calendar" to "/calendar",
    "statistics" to "/statistics",
)

/** helpGuideIdFromLink(): "guide:<id>" for a known guide, else null. */
private fun settingsHelpChatGuideId(link: String): String? {
    if (!link.startsWith("guide:")) return null
    val id = link.removePrefix("guide:")
    return if (SETTINGS_HELP_CHAT_GUIDES.containsKey(id)) id else null
}

private fun settingsHelpChatConversation(json: JsonElement): SettingsHelpChatConversationDto? {
    val obj = (json as? JsonObject)?.get("conversation") as? JsonObject ?: return null
    return runCatching { ApiJson.decodeFromJsonElement(SettingsHelpChatConversationDto.serializer(), obj) }.getOrNull()
}

/** HelpChatSheet — the chat in a full-height bottom sheet with the input in the footer. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun SettingsHelpChatSheet(onClose: () -> Unit) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var conversation by remember { mutableStateOf<SettingsHelpChatConversationDto?>(null) }
    var loading by remember { mutableStateOf(true) }
    var loggedOut by remember { mutableStateOf(false) }
    var text by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var escalating by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf("") }
    var sendingToSupport by remember { mutableStateOf(false) }
    val scroll = rememberScrollState()

    LaunchedEffect(Unit) {
        try {
            conversation = settingsHelpChatConversation(Api.get("/api/chatbot"))
        } catch (e: CancellationException) {
            throw e
        } catch (e: ApiException) {
            if (e.status == 401) {
                loggedOut = true
            } else {
                error = t.t("helpChat.loadError")
            }
        } catch (e: Exception) {
            error = t.t("helpChat.loadError")
        } finally {
            loading = false
        }
    }

    // endRef.scrollIntoView({ block: "end" }) after every change.
    LaunchedEffect(conversation, pending, escalating) {
        withFrameNanos { }
        scroll.scrollTo(scroll.maxValue)
    }

    val busy = pending != null || sendingToSupport
    val escalated = conversation?.escalated ?: false

    fun ask(question: String) {
        val value = question.trim()
        if (value.isEmpty() || pending != null) return
        text = ""
        error = null
        escalating = false
        pending = value
        scope.launch {
            try {
                val next = settingsHelpChatConversation(
                    Api.post("/api/chatbot", mapOf("question" to value, "channel" to SETTINGS_HELP_CHAT_CHANNEL)),
                ) ?: throw IllegalStateException("failed")
                conversation = next
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                error = if (e.status == 429) t.t("helpChat.rateLimited") else t.t("helpChat.sendError")
                text = value
            } catch (e: Exception) {
                error = t.t("helpChat.sendError")
                text = value
            } finally {
                pending = null
            }
        }
    }

    fun sendToSupport() {
        if (sendingToSupport) return
        val current = conversation
        val hasQuestions = (current?.messages?.size ?: 0) > 0
        if (!hasQuestions && note.isBlank()) return
        sendingToSupport = true
        error = null
        scope.launch {
            try {
                val next = settingsHelpChatConversation(
                    Api.post(
                        "/api/chatbot/escalate",
                        mapOf(
                            "conversationId" to (if (current?.escalated == true) null else current?.id),
                            "note" to note,
                            "channel" to SETTINGS_HELP_CHAT_CHANNEL,
                        ),
                    ),
                ) ?: throw IllegalStateException("failed")
                conversation = next
                escalating = false
                note = ""
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = t.t("helpChat.escalateError")
            } finally {
                sendingToSupport = false
            }
        }
    }

    fun startNew() {
        conversation = null
        escalating = false
        error = null
    }

    // Navigation (e.g. a link in an answer) closes the chat.
    fun go(href: String) {
        onClose()
        if (href.endsWith(".html")) {
            // Static help page in public/ — opened outside the app like the Help centre row.
            NativeHooks.openExternalUrl(HelloCalConfig.BASE_URL + href)
        } else {
            nav.push(href)
        }
    }

    // "Guide mig": the web dims the screen and points at the buttons to tap
    // (HelpGuideSpotlight); natively the chat closes and opens the guide's page.
    fun guideMe(id: String) {
        val href = SETTINGS_HELP_CHAT_GUIDES[id] ?: return
        go(href)
    }

    val messages = conversation?.messages.orEmpty()
    val lastAssistant = messages.lastOrNull { it.role == "ASSISTANT" }
    val offerHuman = !escalated && !escalating && lastAssistant?.needsHuman == true && messages.lastOrNull()?.id == lastAssistant?.id
    val linkLabel: (String) -> String = { href ->
        SETTINGS_HELP_CHAT_LINKS[href]?.let { if (t.locale == Locale.Da) it.first else it.second } ?: href
    }

    val footerContent: @Composable ColumnScope.() -> Unit = {
        if (escalated) {
            HcButton(t.t("helpChat.newConversation"), onClick = { startNew() })
        } else {
            SettingsHelpChatInput(
                value = text,
                onValueChange = { text = it },
                placeholder = t.t("helpChat.placeholder"),
                sendLabel = t.t("helpChat.send"),
                inputEnabled = !loading,
                sendEnabled = !busy && !loading && text.isNotBlank(),
                onSend = { ask(text) },
            )
        }
    }

    HcBottomSheet(onDismiss = onClose, title = t.t("helpChat.title"), size = HcSheetSize.Full, footer = if (loggedOut) null else footerContent) {
        Column(
            Modifier.fillMaxSize().verticalScroll(scroll).padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (loggedOut) {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    HcText(t.t("helpChat.loggedOut"), HcTypeRoles.Body)
                    ProfileTextButton(
                        t.t("helpChat.helpCentre"),
                        onClick = { NativeHooks.openExternalUrl(HelloCalConfig.BASE_URL + settingsHelpPagePath(t.locale)) },
                        color = HcColors.Text,
                    )
                }
            } else {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SettingsHelpChatBubble(user = false) {
                        HcText(t.t("helpChat.welcome"), HcTypeRoles.Body, color = HcColors.Black)
                    }
                    if (messages.isEmpty() && !loading && pending == null) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            SETTINGS_HELP_CHAT_SUGGESTIONS.forEach { key ->
                                SettingsHelpChatChoice(t.t(key)) { ask(t.t(key)) }
                            }
                        }
                    }

                    messages.forEach { message ->
                        if (message.role == "SYSTEM") {
                            Column(
                                Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                HcText(message.body, HcTypeRoles.Caption, align = TextAlign.Center)
                                val requestId = conversation?.supportRequestId
                                if (requestId != null) {
                                    ProfileTextButton(
                                        t.t("helpChat.openCase"),
                                        onClick = { go("/settings/support/requests/$requestId") },
                                        color = HcColors.Text,
                                    )
                                }
                            }
                        } else {
                            val isUser = message.role == "USER"
                            SettingsHelpChatBubble(user = isUser) {
                                if (!isUser) {
                                    SettingsHelpChatShortcuts(
                                        links = message.links,
                                        linkLabel = linkLabel,
                                        onGo = ::go,
                                        onGuide = ::guideMe,
                                        guideLabel = t.t("helpChat.guideMe"),
                                    )
                                }
                                HcText(message.body, HcTypeRoles.Body, color = if (isUser) HcColors.White else HcColors.Black)
                            }
                        }
                    }

                    val waiting = pending
                    if (waiting != null) {
                        SettingsHelpChatBubble(user = true) {
                            HcText(waiting, HcTypeRoles.Body, color = HcColors.White)
                        }
                        HcText(t.t("helpChat.thinking"), HcTypeRoles.Caption)
                    }

                    if (offerHuman) {
                        SettingsHelpChatPanel {
                            HcText(t.t("helpChat.offerHuman"), HcTypeRoles.Body)
                            HcButton(t.t("helpChat.talkToHuman"), onClick = { escalating = true }, kind = HcButtonKind.Secondary)
                        }
                    }

                    if (escalating && !escalated) {
                        SettingsHelpChatPanel {
                            HcText(t.t("helpChat.escalateTitle"), HcTypeRoles.Title)
                            HcText(
                                if (messages.isNotEmpty()) t.t("helpChat.escalateIntro") else t.t("helpChat.escalateIntroEmpty"),
                                HcTypeRoles.Body,
                                color = HcColors.TextSecondary,
                            )
                            ProfileTextArea(
                                note,
                                { note = it },
                                placeholder = t.t("helpChat.notePlaceholder"),
                                minLines = 3,
                                maxLength = 5000,
                                radius = HcDimens.RadiusCard,
                            )
                            HcButton(
                                if (sendingToSupport) t.t("helpChat.sending") else t.t("helpChat.sendToSupport"),
                                onClick = ::sendToSupport,
                                enabled = !sendingToSupport && !(messages.isEmpty() && note.isBlank()),
                            )
                            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                                ProfileTextButton(t.t("common.cancel"), onClick = { escalating = false }, color = HcColors.Text)
                            }
                        }
                    }

                    val message = error
                    if (message != null) HcText(message, HcTypeRoles.Body, color = HcColors.RedDark)

                    if (!escalating) {
                        // The ways to contact a person sit discreetly at the bottom (DECISIONS 2026-10-03).
                        FlowRow(
                            Modifier.fillMaxWidth().padding(top = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterHorizontally),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            if (!escalated && !offerHuman) {
                                ProfileTextButton(
                                    t.t("helpChat.talkToHuman"),
                                    onClick = {
                                        escalating = true
                                        error = null
                                    },
                                    color = HcColors.Text,
                                    enabled = !busy,
                                )
                            }
                            ProfileTextButton(t.t("helpChat.contactForm"), onClick = { go("/settings/support/contact") }, color = HcColors.Text)
                        }
                    }
                }
            }
        }
    }
}

/** Bubble: the user's on the right in green with white text, the assistant's on the left in tan; max 85 % wide. */
@Composable
private fun SettingsHelpChatBubble(user: Boolean, content: @Composable () -> Unit) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val w = maxWidth
        Column(
            Modifier
                .align(if (user) Alignment.CenterEnd else Alignment.CenterStart)
                .widthIn(max = w * 0.85f)
                .clip(RoundedCornerShape(HcDimens.RadiusCard))
                .background(if (user) HcColors.Green else HcColors.Tan)
                .padding(horizontal = 16.dp, vertical = 10.dp),
        ) {
            content()
        }
    }
}

/** .hf-panel — surface with a 1 px nav border, 16 px padding, 8 px gap. */
@Composable
private fun SettingsHelpChatPanel(content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(HcColors.Surface, shape).border(1.dp, HcColors.Nav, shape).padding(HcDimens.SpaceBlock),
        verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline),
        content = content,
    )
}

/** .hf-choice px-3 py-2 — a suggested question. */
@Composable
private fun SettingsHelpChatChoice(label: String, onClick: () -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Box(
        Modifier.heightIn(min = 40.dp).clip(shape).background(HcColors.Card, shape).clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        HcText(label, HcTypeRoles.Small, bold = true, color = HcColors.Text, align = TextAlign.Center)
    }
}

/**
 * MessageShortcuts — page shortcuts as underlined text buttons at the top of
 * the answer, and "Guide mig" as a button right under them (DECISIONS 2026-10-07).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SettingsHelpChatShortcuts(
    links: List<String>,
    linkLabel: (String) -> String,
    onGo: (String) -> Unit,
    onGuide: (String) -> Unit,
    guideLabel: String,
) {
    val guideId = links.firstNotNullOfOrNull { settingsHelpChatGuideId(it) }
    val pages = links.filter { settingsHelpChatGuideId(it) == null }
    if (pages.isEmpty() && guideId == null) return
    Column(Modifier.padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (pages.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                pages.forEach { href ->
                    ProfileTextButton(linkLabel(href), onClick = { onGo(href) }, color = HcColors.Black)
                }
            }
        }
        if (guideId != null) {
            Box(
                Modifier
                    .height(HcDimens.ControlHeight)
                    .clip(RoundedCornerShape(HcDimens.RadiusCard))
                    .background(HcColors.Action)
                    .clickable { onGuide(guideId) }
                    .padding(horizontal = 20.dp),
                contentAlignment = Alignment.Center,
            ) {
                HcText(guideLabel, HcTypeRoles.Button, color = HcColors.White)
            }
        }
    }
}

/** The footer form: textarea (1 row, grows to 128 px, max 1000 characters) + 48 px send button. */
@Composable
private fun SettingsHelpChatInput(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    sendLabel: String,
    inputEnabled: Boolean,
    sendEnabled: Boolean,
    onSend: () -> Unit,
) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        BasicTextField(
            value = value,
            onValueChange = { onValueChange(it.take(1000)) },
            enabled = inputEnabled,
            textStyle = HcTypeRoles.Input.style(),
            cursorBrush = SolidColor(HcColors.Action),
            // Enter sends (web: Enter without Shift submits the form).
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { if (sendEnabled) onSend() }),
            modifier = Modifier
                .weight(1f)
                .heightIn(min = HcDimens.ControlHeight, max = 128.dp)
                .background(HcColors.White, shape)
                .border(1.dp, HcColors.FieldBorder, shape),
            decorationBox = { inner ->
                Box(Modifier.padding(horizontal = 12.dp, vertical = 12.dp), contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Input, color = HcColors.Placeholder)
                    inner()
                }
            },
        )
        Box(
            Modifier
                .size(HcDimens.ControlHeight)
                .clip(shape)
                .background(HcColors.Action, shape)
                .clickable(enabled = sendEnabled, onClick = onSend),
            contentAlignment = Alignment.Center,
        ) {
            HcIcon(
                "Send",
                Modifier.alpha(if (sendEnabled) 1f else 0.4f),
                size = 20.dp,
                stroke = 1.6f,
                color = HcColors.White,
                contentDescription = sendLabel,
            )
        }
    }
}

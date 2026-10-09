package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.ProfileEllipsisText
import dk.packroff.hellocal.ui.ProfileLine
import dk.packroff.hellocal.ui.ProfilePointsPromoBanner
import dk.packroff.hellocal.ui.ProfileTextArea
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.ceil

private const val DRAFT_STORAGE_KEY = "hellocal.invite-draft"
private const val INVITE_NOTE_MAX_LENGTH = 160
private const val INVITE_NAME_MAX_LENGTH = 60

@Serializable
private data class ReferredUser(val displayName: String = "")

@Serializable
private data class Referral(val id: String, val referredUser: ReferredUser = ReferredUser(), val rewardGrantedAt: String? = null)

@Serializable
private data class Invitation(val id: String, val email: String, val sentAt: String, val expiresAt: String, val acceptedAt: String? = null)

/** src/lib/invite-message.ts buildInviteMessage — the standard text shared from "Invitér en ven". */
private fun buildInviteMessage(name: String, note: String): String {
    val trimmedName = name.trim()
    val trimmedNote = note.trim()
    val greeting = if (trimmedName.isNotEmpty()) "Hej! Det er $trimmedName." else "Hej!"
    val parts = mutableListOf("$greeting Jeg vil gerne invitere dig til Hello Cal – appen, der gør det nemt at holde styr på kalorier, vægt og gode vaner.")
    if (trimmedNote.isNotEmpty()) parts += trimmedNote
    parts += "Opret din gratis konto via linket, så optjener vi begge 300 points."
    return parts.joinToString("\n\n")
}

private fun expiryLabel(expiresAt: String): String {
    val expires = ProfileDates.parseInstant(expiresAt) ?: return ""
    val msLeft = expires.toEpochMilliseconds() - Clock.System.now().toEpochMilliseconds()
    if (msLeft <= 0) return "Udløbet"
    val daysLeft = ceil(msLeft / (24.0 * 60 * 60 * 1000)).toInt()
    return if (daysLeft <= 1) "Udløber i dag" else "Udløber om $daysLeft dage"
}

/**
 * Native port of src/app/profile/invite/page.tsx ("Invitér en ven",
 * docs/DECISIONS.md 2026-09-02): 300 points to both when the invited friend
 * has an account. The page hard-codes its Danish texts, so do we.
 */
@Composable
fun InviteScreen(args: RouteArgs) {
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var referralCode by remember { mutableStateOf<String?>(null) }
    var referrals by remember { mutableStateOf<List<Referral>>(emptyList()) }
    var copied by remember { mutableStateOf(false) }
    var invitations by remember { mutableStateOf<List<Invitation>>(emptyList()) }
    var inviteEmail by remember { mutableStateOf("") }
    var sendingInvite by remember { mutableStateOf(false) }
    var inviteError by remember { mutableStateOf<String?>(null) }
    var resendingId by remember { mutableStateOf<String?>(null) }
    var senderName by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }

    suspend fun loadInvitations() {
        runCatching {
            val list = (Api.get("/api/invitations") as JsonObject)["invitations"]!!
            ApiJson.decodeFromJsonElement(ListSerializer(Invitation.serializer()), list)
        }.getOrNull()?.let { invitations = it }
    }

    // Name and note are remembered on the device as a draft; without one, the profile name is suggested.
    LaunchedEffect(Unit) {
        val profileName = runCatching { ProfileApi.loadUser().displayName }.getOrDefault("")
        val draft = runCatching { NativeHooks.secureStorage.get(DRAFT_STORAGE_KEY)?.let { Json.parseToJsonElement(it) as? JsonObject } }.getOrNull()
        val draftName = (draft?.get("name") as? JsonPrimitive)?.takeIf { it.isString }?.content
        val draftNote = (draft?.get("note") as? JsonPrimitive)?.takeIf { it.isString }?.content
        senderName = draftName ?: profileName
        if (draftNote != null) note = draftNote.take(INVITE_NOTE_MAX_LENGTH)
    }
    LaunchedEffect(Unit) {
        runCatching { Api.get("/api/referrals") as JsonObject }.getOrNull()?.let { data ->
            referralCode = data["referralCode"]?.jsonPrimitive?.contentOrNull
            referrals = data["referrals"]?.let { runCatching { ApiJson.decodeFromJsonElement(ListSerializer(Referral.serializer()), it) }.getOrNull() } ?: emptyList()
        }
        loadInvitations()
    }

    fun updateDraft(name: String = senderName, nextNote: String = note) {
        senderName = name
        note = nextNote
        runCatching {
            NativeHooks.secureStorage.set(DRAFT_STORAGE_KEY, JsonObject(mapOf("name" to JsonPrimitive(name), "note" to JsonPrimitive(nextNote))).toString())
        }
    }

    fun sendInvitation() {
        sendingInvite = true
        inviteError = null
        scope.launch {
            try {
                Api.post("/api/invitations", mapOf("email" to inviteEmail, "name" to senderName, "note" to note))
                inviteEmail = ""
                loadInvitations()
            } catch (e: ApiException) {
                inviteError = e.message.ifBlank { "Kunne ikke sende invitationen" }
            } catch (e: Exception) {
                inviteError = "Kunne ikke sende invitationen — tjek din forbindelse og prøv igen"
            } finally {
                sendingInvite = false
            }
        }
    }

    fun resendInvitation(id: String) {
        resendingId = id
        scope.launch {
            runCatching { Api.post("/api/invitations/$id/resend", mapOf("name" to senderName, "note" to note)) }
            loadInvitations()
            resendingId = null
        }
    }

    val shareUrl = referralCode?.let { "https://hellocal.io/signup?ref=$it" }
    val shareText = buildInviteMessage(senderName, note)

    // The phone's share menu with the standard text + link; without one the text is copied instead.
    fun share() {
        val url = shareUrl ?: return
        val full = "$shareText\n\n$url"
        if (ProfileNativeBridge.share(full)) return
        clipboard.setText(AnnotatedString(full))
        copied = true
        scope.launch {
            delay(2000)
            copied = false
        }
    }

    HcScreen(
        title = "Invitér en ven",
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 24.dp, bottom = 32.dp),
        bottom = {
            HcButton(
                if (copied) "Tekst og link kopieret!" else "Del dit invite-link",
                onClick = ::share,
                enabled = shareUrl != null,
                leading = { HcIcon("Share3", size = 24.dp, color = HcColors.White) },
            )
        },
    ) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            ProfilePointsPromoBanner(
                headline = "I optjener begge 300 points, når din ven har oprettet en konto",
                subtext = "300 points kan indløses til 1 gratis måned under Profil → Points.",
                onTermsClick = { nav.push("/betingelser#pointsystem") },
            )

            HcSectionTitle("Din invitation")
            HcTextField(senderName, { updateDraft(name = it.take(INVITE_NAME_MAX_LENGTH)) }, label = "Dit navn", standard = true)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                HcText("Personlig besked (valgfri)", HcTypeRoles.Label)
                ProfileTextArea(note, { updateDraft(nextNote = it) }, placeholder = "Skriv en hilsen til din ven", minLines = 2, maxLength = INVITE_NOTE_MAX_LENGTH, radius = HcDimens.RadiusCard)
                HcText("${note.length}/$INVITE_NOTE_MAX_LENGTH", HcTypeRoles.Caption, Modifier.fillMaxWidth(), align = TextAlign.End)
            }

            HcSectionTitle("Sådan ser beskeden ud")
            val shape = RoundedCornerShape(8.dp)
            Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Card, shape).padding(16.dp)) {
                HcText(shareText, HcTypeRoles.Body)
                HcText(shareUrl ?: "Henter dit link…", HcTypeRoles.Caption, Modifier.padding(top = 8.dp))
            }

            HcSectionTitle("Send invitation pr. e-mail")
            Column {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcTextField(inviteEmail, { inviteEmail = it }, Modifier.weight(1f), placeholder = "ven@eksempel.dk", keyboardType = KeyboardType.Email, standard = true)
                    HcButton(if (sendingInvite) "Sender…" else "Send", onClick = ::sendInvitation, enabled = !sendingInvite && inviteEmail.isNotBlank(), modifier = Modifier.width(96.dp))
                }
                inviteError?.let { HcText(it, HcTypeRoles.Caption, Modifier.padding(top = 4.dp), color = HcColors.RedDark) }
            }

            HcSectionTitle("Afsendte invitationer")
            if (invitations.isEmpty()) {
                HcText("Ingen invitationer sendt endnu.", HcTypeRoles.Body, color = HcColors.TextSecondary)
            } else {
                Column(Modifier.fillMaxWidth()) {
                    invitations.forEachIndexed { index, invitation ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                ProfileEllipsisText(invitation.email, HcTypeRoles.Body)
                                HcText("${ProfileDates.dayMonthTime(invitation.sentAt)} · ${expiryLabel(invitation.expiresAt)}", HcTypeRoles.Caption, color = HcColors.TextSecondary)
                            }
                            val busy = resendingId == invitation.id
                            Box(
                                Modifier.padding(start = 8.dp).size(44.dp).clip(CircleShape).alpha(if (busy) 0.5f else 1f)
                                    .clickable(enabled = !busy) { resendInvitation(invitation.id) },
                                contentAlignment = Alignment.Center,
                            ) { HcIcon("Refresh", size = 18.dp, color = HcColors.Green, contentDescription = "Send invitation til ${invitation.email} igen") }
                        }
                        if (index < invitations.lastIndex) ProfileLine()
                    }
                }
            }

            HcSectionTitle("Tilmeldte venner")
            if (referrals.isEmpty()) {
                HcText("Ingen venner inviteret endnu.", HcTypeRoles.Body, color = HcColors.TextSecondary)
            } else {
                Column(Modifier.fillMaxWidth()) {
                    referrals.forEachIndexed { index, referral ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            HcText(referral.referredUser.displayName, HcTypeRoles.Body, Modifier.weight(1f))
                            HcText(if (referral.rewardGrantedAt != null) "300 points givet" else "Venter (min. 3 måneder)", HcTypeRoles.Caption, color = HcColors.TextSecondary)
                        }
                        if (index < referrals.lastIndex) ProfileLine()
                    }
                }
            }
        }
    }
}

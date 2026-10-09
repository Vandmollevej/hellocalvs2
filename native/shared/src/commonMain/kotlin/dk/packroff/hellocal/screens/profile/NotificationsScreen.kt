package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
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
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.ProfileLine
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject

// The web page hard-codes these Danish event names.
private val EVENT_LABELS = mapOf(
    "FRIEND_REFERRAL" to "Invitér en ven",
    "PRODUCT_APPROVED" to "Vare godkendt",
    "PRODUCT_REJECTED" to "Vare afvist",
    "BUG_REPORT_RESOLVED" to "Fejlrapport løst",
    "BUG_REPORT_REJECTED" to "Fejlrapport afvist",
    "POINTS_AWARDED" to "Points optjent",
    "FRIEND_FORWARD_RECEIVED" to "Videresendelse fra en ven",
)

@Serializable
private data class NotificationPreference(val event: String, val email: Boolean = false, val push: Boolean = false)

/**
 * Native port of src/app/profile/notifications/page.tsx ("Kommunikation"):
 * the four general User.wants* toggles plus the event-specific e-mail/push toggles.
 */
@Composable
fun NotificationsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var user by remember { mutableStateOf<ProfileUser?>(null) }
    var preferences by remember { mutableStateOf<List<NotificationPreference>?>(null) }

    LaunchedEffect(Unit) {
        coroutineScope {
            launch { runCatching { ProfileApi.loadUser() }.getOrNull()?.let { user = it } }
            launch {
                runCatching {
                    val list = (Api.get("/api/notification-preferences") as JsonObject)["preferences"]!!
                    ApiJson.decodeFromJsonElement(ListSerializer(NotificationPreference.serializer()), list)
                }.getOrNull()?.let { preferences = it }
            }
        }
    }

    fun updateUser(key: String, value: Boolean, apply: (ProfileUser) -> ProfileUser) {
        user = user?.let(apply)
        scope.launch { runCatching { ProfileApi.patch(mapOf(key to value)) } }
    }

    fun updatePreference(event: String, field: String, value: Boolean) {
        preferences = preferences?.map { if (it.event != event) it else if (field == "email") it.copy(email = value) else it.copy(push = value) }
        scope.launch { runCatching { Api.patch("/api/notification-preferences", mapOf("event" to event, field to value)) } }
    }

    HcScreen(title = t.t("profile.section.communication"), contentPadding = ProfilePagePadding) {
        ProfilePage {
            HcText(t.t("profile.communication.intro"), HcTypeRoles.Body, color = HcColors.TextSecondary)
            val current = user
            if (current == null) {
                HcLoader()
            } else {
                HcText(t.t("profile.communication.pushSection"), HcTypeRoles.SectionTitle)
                ProfileLine()
                HcToggle(current.wantsPushNotifications, { v -> updateUser("wantsPushNotifications", v) { it.copy(wantsPushNotifications = v) } }, label = t.t("profile.communication.push"))

                HcText(t.t("profile.communication.emailSection"), HcTypeRoles.SectionTitle)
                ProfileLine()
                HcToggle(current.wantsUpdateNewsEmails, { v -> updateUser("wantsUpdateNewsEmails", v) { it.copy(wantsUpdateNewsEmails = v) } }, label = t.t("profile.communication.updateNews"))
                HcToggle(current.wantsAdviceEmails, { v -> updateUser("wantsAdviceEmails", v) { it.copy(wantsAdviceEmails = v) } }, label = t.t("profile.communication.advice"))

                HcText(t.t("profile.communication.partnerSection"), HcTypeRoles.SectionTitle)
                ProfileLine()
                HcToggle(current.wantsPartnerOffersEmails, { v -> updateUser("wantsPartnerOffersEmails", v) { it.copy(wantsPartnerOffersEmails = v) } }, label = t.t("profile.communication.partnerOffers"))
            }

            HcText(t.t("profile.communication.specificSection"), HcTypeRoles.SectionTitle)
            ProfileLine()
            HcText(t.t("profile.communication.specificHint"), HcTypeRoles.Caption, Modifier.offset(y = (-8).dp), color = HcColors.TextSecondary)
            val prefs = preferences
            if (prefs == null) {
                HcLoader()
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    prefs.forEach { pref ->
                        val shape = RoundedCornerShape(HcDimens.RadiusCard)
                        Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(16.dp)) {
                            HcText(EVENT_LABELS[pref.event] ?: pref.event, HcTypeRoles.Body, Modifier.padding(bottom = 16.dp))
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                HcText("E-mail", HcTypeRoles.Body, Modifier.weight(1f))
                                HcToggle(pref.email, { updatePreference(pref.event, "email", it) })
                            }
                            Row(Modifier.fillMaxWidth().padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                                HcText("Push", HcTypeRoles.Body, Modifier.weight(1f))
                                HcToggle(pref.push, { updatePreference(pref.event, "push", it) })
                            }
                        }
                    }
                }
            }

            HcText(
                t.t("profile.communication.termsLink"),
                HcTypeRoles.Body,
                Modifier.fillMaxWidth().padding(top = 8.dp).clickable { nav.push("/betingelser") },
                color = HcColors.TextSecondary,
                underline = true,
                align = TextAlign.Center,
            )
        }
    }
}

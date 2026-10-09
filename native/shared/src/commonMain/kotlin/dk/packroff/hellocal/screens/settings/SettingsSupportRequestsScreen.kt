package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcDivider
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsAccordionCard
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import kotlinx.serialization.Serializable

// Native port of src/app/settings/support/requests/page.tsx — Indstillinger →
// Support → Mine henvendelser (docs/DECISIONS.md 2026-09-26 "Support-indbakke"):
// the user's cases with status and a marker for new replies.

/** One row of GET /api/support/requests (listUserSupportRequests in src/lib/support-inbox.ts). */
@Serializable
data class SupportRequestSummaryDto(
    val id: String,
    val subject: String = "",
    val category: String = "OTHER",
    val status: String = "OPEN",
    val awaitingReply: Boolean = false,
    val userUnread: Boolean = false,
    val createdAt: String = "",
    val updatedAt: String = "",
)

@Serializable
private data class SupportRequestListResponseDto(val requests: List<SupportRequestSummaryDto> = emptyList())

@Composable
fun SettingsSupportRequestsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var requests by remember { mutableStateOf<List<SupportRequestSummaryDto>?>(null) }
    var error by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            requests = ApiJson.decodeFromJsonElement(SupportRequestListResponseDto.serializer(), Api.get("/api/support/requests")).requests
        } catch (e: Exception) {
            error = true
        }
    }

    fun statusLabel(request: SupportRequestSummaryDto): String = when {
        request.status == "RESOLVED" -> t.t("settings.support.statusResolved")
        request.awaitingReply -> t.t("settings.support.statusAwaiting")
        else -> t.t("settings.support.statusAnswered")
    }

    HcScreen(title = t.t("settings.support.myRequests"), contentPadding = SettingsPagePadding) {
        SettingsPage(gap = HcDimens.SpaceBlock) {
            if (error) HcError(t.t("settings.support.requestsLoadError"))
            val list = requests
            if (list == null && !error) HcLoader()
            if (list != null && list.isEmpty()) {
                HcText(t.t("settings.support.requestsEmpty"), HcTypeRoles.Body, color = HcColors.TextSecondary)
            }
            if (list != null && list.isNotEmpty()) {
                SettingsAccordionCard {
                    list.forEachIndexed { index, request ->
                        Column(Modifier.fillMaxWidth()) {
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .clickable { nav.push("/settings/support/requests/${request.id}") }
                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Column(Modifier.weight(1f)) {
                                    HcText(request.subject, HcTypeRoles.Body, bold = request.userUnread, maxLines = 1)
                                    HcText(
                                        t.t("settings.support.caseLabel", "caseCode" to settingsSupportCaseCode(request.id)) +
                                            " · " + statusLabel(request),
                                        HcTypeRoles.Caption,
                                        color = HcColors.TextSecondary,
                                    )
                                }
                                if (request.userUnread) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Box(Modifier.size(10.dp).background(HcColors.Action, CircleShape))
                                        HcText(t.t("settings.support.newReply"), HcTypeRoles.Caption)
                                    }
                                }
                            }
                            if (index < list.size - 1) HcDivider()
                        }
                    }
                }
            }
            HcButton(t.t("settings.support.contact"), onClick = { nav.push("/settings/support/contact") })
        }
    }
}

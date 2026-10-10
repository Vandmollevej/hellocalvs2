package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject

/** GET /api/auth/login-approval/pending → { approvals: [...] } */
@Serializable
internal data class PendingApproval(val id: String, val device: String = "", val country: String? = null, val createdAt: String = "")

/**
 * Native port of src/app/approve-login/page.tsx — opened from the push
 * notification on a device that is already logged in; lists pending logins
 * from new devices with Approve / Deny, refreshed every 4 s.
 */
@Composable
fun ApproveLoginScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var approvals by remember { mutableStateOf<List<PendingApproval>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun load() {
        try {
            val data = Api.get("/api/auth/login-approval/pending").jsonObject
            val list = data["approvals"] as? JsonArray
            approvals = list?.map { ApiJson.decodeFromJsonElement(PendingApproval.serializer(), it) } ?: emptyList()
        } catch (e: CancellationException) {
            throw e
        } catch (e: ApiException) {
            if (e.status == 401) nav.replace("/login?next=/approve-login") else error = t.t("loginApproval.error.failed")
        } catch (e: Exception) {
            error = t.t("loginApproval.error.failed")
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            load()
            delay(4000)
        }
    }

    fun respond(id: String, approve: Boolean) {
        error = null
        scope.launch {
            try {
                Api.post("/api/auth/login-approval/pending", mapOf("approvalId" to id, "approve" to approve))
            } catch (e: CancellationException) {
                throw e
            } catch (e: ApiException) {
                error = e.serverMessage() ?: t.t("loginApproval.error.failed")
            } catch (e: Exception) {
                error = t.t("loginApproval.error.failed")
            }
            load()
        }
    }

    HcScreen(title = t.t("loginApproval.approveTitle"), contentPadding = PaddingValues(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            val list = approvals
            if (list != null && list.isEmpty()) {
                HcText(t.t("loginApproval.nonePending"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
            list?.forEach { approval ->
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(HcColors.White).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    HcText(t.t("loginApproval.question", "device" to approval.device), HcTypeRoles.Body, bold = true)
                    approval.country?.let { HcText(it, HcTypeRoles.Caption, color = HcColors.TextSecondary) }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        PillOutlineButton(t.t("loginApproval.deny"), Modifier.weight(1f)) { respond(approval.id, false) }
                        HcButton(t.t("loginApproval.approve"), onClick = { respond(approval.id, true) }, modifier = Modifier.weight(1f))
                    }
                }
            }
            HcError(error)
        }
    }
}

/** "hf-control rounded-full border border-hf-gray-border" — the deny button. */
@Composable
private fun PillOutlineButton(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Box(
        modifier.height(HcDimens.ControlHeight).clip(shape).border(1.dp, HcColors.GrayBorder, shape).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        HcText(label, HcTypeRoles.Button, align = TextAlign.Center)
    }
}

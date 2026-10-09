package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * Native port of src/app/profile/login-approval/page.tsx — turn on "approve
 * logins with a notification": the user allows notifications on this device,
 * and new logins must then be approved here (docs/DECISIONS.md 2026-10-03).
 */
@Composable
fun LoginApprovalScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var enabled by remember { mutableStateOf<Boolean?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        enabled = runCatching {
            (Api.get("/api/push/subscribe") as JsonObject)["loginApprovalEnabled"]?.jsonPrimitive?.booleanOrNull == true
        }.getOrDefault(false)
    }

    fun toggle() {
        val current = enabled ?: return
        if (busy) return
        error = null
        busy = true
        val next = !current
        scope.launch {
            if (next) {
                // Native push permission + device registration (web: enablePush with Web Push).
                val result = runCatching { ProfileNativeBridge.enablePush() }.getOrDefault("failed")
                if (result != "ok") {
                    error = t.t("loginApproval.error.$result")
                    busy = false
                    return@launch
                }
            }
            val ok = runCatching { Api.post("/api/profile/login-approval", mapOf("enabled" to next)) }.isSuccess
            if (ok) enabled = next else error = t.t("loginApproval.error.failed")
            busy = false
        }
    }

    HcScreen(title = t.t("loginApproval.title")) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            HcText(t.t("loginApproval.description"), HcTypeRoles.Body)
            val shape = RoundedCornerShape(12.dp)
            val disabled = enabled == null || busy
            Row(
                Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(shape).background(HcColors.White, shape).alpha(if (disabled) 0.5f else 1f)
                    .clickable(enabled = !disabled, onClick = ::toggle).padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                HcText(t.t("loginApproval.toggle"), HcTypeRoles.Body, Modifier.weight(1f))
                HcText(if (enabled == true) t.t("loginApproval.on") else t.t("loginApproval.off"), HcTypeRoles.Body, bold = true)
            }
            HcText(t.t("loginApproval.hint"), HcTypeRoles.Caption, color = HcColors.TextSecondary)
            error?.let { HcText(it, HcTypeRoles.Caption, color = HcColors.RedDark) }
        }
    }
}

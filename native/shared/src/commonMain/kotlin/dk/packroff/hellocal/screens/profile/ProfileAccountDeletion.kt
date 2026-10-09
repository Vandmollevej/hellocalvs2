package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileFilledField
import dk.packroff.hellocal.ui.ProfileTextButton
import kotlinx.coroutines.launch

/**
 * src/components/profile/AccountDeletionSection.tsx — at the bottom of
 * /profile/edit. "Ret til at blive glemt" anonymises at once and the user must
 * type the control word; "Luk konto" is only a black underlined text link and
 * can be undone by logging in within 3 months.
 */
@Composable
fun ProfileAccountDeletionSection() {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf<String?>(null) }
    var confirm by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun open(next: String) {
        mode = next
        confirm = ""
        error = null
    }

    Column(Modifier.fillMaxWidth().padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HcText(t.t("accountSettings.forgetTitle"), HcTypeRoles.Body, bold = true)
            HcText(t.t("accountSettings.forgetIntro"), HcTypeRoles.Body, color = HcColors.TextSecondary)
            HcButton(t.t("accountSettings.forgetButton"), onClick = { open("forget") })
        }
        ProfileTextButton(t.t("accountSettings.closeLink"), onClick = { open("close") }, color = HcColors.Black)
    }

    val currentMode = mode ?: return
    // The control word is typed in the user's own language (the server always gets "SLET").
    val controlWord = t.t(if (currentMode == "close") "accountSettings.closeWord" else "accountSettings.confirmWord")
    val controlOk = confirm.trim().uppercase() == controlWord.uppercase()

    fun submit() {
        if (!controlOk) return
        busy = true
        error = null
        scope.launch {
            val ok = runCatching {
                Api.post("/api/account/close", mapOf("mode" to currentMode, "confirm" to if (currentMode == "forget") "SLET" else confirm.trim()))
            }.isSuccess
            if (ok) {
                // web: router.push("/login") — the session is gone, so the app shows the login.
                Session.logout()
            } else {
                error = t.t("accountSettings.error")
                busy = false
            }
        }
    }

    HcBottomSheet(onDismiss = { if (!busy) mode = null }) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (currentMode == "close") HcText(t.t("accountSettings.closeSheetText"), HcTypeRoles.Body)
            HcText(t.t(if (currentMode == "close") "accountSettings.closeWarning" else "accountSettings.confirmWarning", "word" to controlWord), HcTypeRoles.Body)
            ProfileFilledField(
                confirm,
                { confirm = it },
                Modifier.fillMaxWidth(),
                placeholder = t.t("accountSettings.confirmPlaceholder", "word" to controlWord),
            )
            if (error != null) HcText(error!!, HcTypeRoles.Body, color = HcColors.RedDark)
            if (currentMode == "close") {
                ProfileTextButton(t.t("accountSettings.closeConfirmButton"), onClick = ::submit, color = HcColors.Black, enabled = !busy && controlOk)
            } else {
                HcButton(t.t("accountSettings.confirmButton"), onClick = ::submit, enabled = !busy && controlOk)
            }
        }
    }
}

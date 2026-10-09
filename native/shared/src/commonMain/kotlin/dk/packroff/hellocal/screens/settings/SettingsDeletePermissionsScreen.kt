package dk.packroff.hellocal.screens.settings

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import kotlinx.coroutines.launch

/**
 * Native port of src/app/settings/delete-permissions/page.tsx — per profile the
 * creator decides whether the profile's owner may delete registrations that
 * others entered (docs/FAMILY.md). Children start with "no".
 */
@Composable
fun SettingsDeletePermissionsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf<FamilyStatus?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { status = loadFamilyStatus() }

    val current = status
    val controlled = current?.family?.members.orEmpty()
        .filter { it.controllerId == current?.me?.id && it.userId != current?.me?.id }

    fun update(userId: String, value: Boolean) {
        busy = true
        error = null
        scope.launch {
            val ok = runCatching { Api.patch("/api/family/members/$userId", mapOf("canDeleteOthersEntries" to value)) }.isSuccess
            if (!ok) error = t.t("family.error.unknown")
            status = loadFamilyStatus() ?: status
            busy = false
        }
    }

    // .hf-page.hf-stack: 8 px between the blocks.
    HcScreen(title = t.t("family.deletePermissions.title"), contentPadding = SettingsPagePadding) {
        SettingsPage(gap = 8.dp) {
            HcText(t.t("family.deletePermissions.intro"), HcTypeRoles.Body)
            val message = error
            if (message != null) HcText(message, HcTypeRoles.Body, color = HcColors.RedDark)
            when {
                current == null -> HcLoader()
                controlled.isEmpty() -> HcText(t.t("family.deletePermissions.none"), HcTypeRoles.Body)
                else -> controlled.forEach { member ->
                    HcToggle(
                        checked = member.canDeleteOthersEntries,
                        onChange = { value -> update(member.userId, value) },
                        label = member.displayName,
                        description = if (member.isChild) t.t("family.child") else null,
                        enabled = !busy,
                    )
                }
            }
        }
    }
}

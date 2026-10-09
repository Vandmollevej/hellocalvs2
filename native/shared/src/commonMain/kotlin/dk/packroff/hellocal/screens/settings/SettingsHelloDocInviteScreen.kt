package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.VSpace
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/**
 * Native port of src/app/settings/hello-doc/invite/page.tsx — "Inviter
 * bruger". The heading/description styling follows the HelloFresh checkout
 * reference the user supplied (docs/DECISIONS.md 2026-09-12).
 */
@Composable
fun SettingsHelloDocInviteScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var categories by remember { mutableStateOf(SettingsHelloDoc.DefaultCategories) }
    var historyRange by remember { mutableStateOf("ALL") }
    var expiresAt by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun sendInvitation() {
        sending = true
        error = null
        scope.launch {
            try {
                Api.post(
                    "/api/doctor-shares",
                    mapOf("name" to name, "email" to email, "categories" to categories, "historyRange" to historyRange, "expiresAt" to expiresAt.ifEmpty { null }),
                )
                // web: router.replace("/settings/hello-doc"). When the list is the
                // screen below, go back to it instead of stacking a second copy.
                val below = nav.stack.getOrNull(nav.stack.lastIndex - 1)
                if (below?.path == "/settings/hello-doc") nav.back() else nav.replace("/settings/hello-doc")
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = SettingsHelloDoc.errorMessage(e, t.t("helloDoc.errorGeneric"))
            } finally {
                sending = false
            }
        }
    }

    HcScreen(
        title = t.t("helloDoc.inviteTitle"),
        contentPadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection),
        bottom = {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline)) {
                HcButton(
                    label = if (sending) t.t("helloDoc.sending") else t.t("helloDoc.sendInvitation"),
                    onClick = ::sendInvitation,
                    enabled = !sending && name.isNotBlank() && email.isNotBlank(),
                )
                HcText(
                    t.t("helloDoc.invitationExpiryHint"),
                    HcTypeRoles.Caption,
                    Modifier.fillMaxWidth(),
                    color = HcColors.TextSecondary,
                    align = TextAlign.Center,
                )
                val message = error
                if (message != null) {
                    HcText(message, HcTypeRoles.Caption, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center)
                }
            }
        },
    ) {
        HcText(t.t("helloDoc.inviteHeading"), HcTypeRoles.Hero, color = HcColors.Black)
        VSpace(8.dp)
        HcText(t.t("helloDoc.inviteHeadingDescription"), HcTypeRoles.BodyLg, color = HcColors.TextSecondary)
        VSpace(32.dp)

        SettingsHelloDocEditor(
            name = name,
            onNameChange = { name = it },
            email = email,
            onEmailChange = { email = it },
            categories = categories,
            onCategoriesChange = { categories = it },
            historyRange = historyRange,
            onHistoryRangeChange = { historyRange = it },
            expiresAt = expiresAt,
            onExpiresAtChange = { expiresAt = it },
            onPreview = { nav.push("/settings/hello-doc/preview") },
        )
    }
}

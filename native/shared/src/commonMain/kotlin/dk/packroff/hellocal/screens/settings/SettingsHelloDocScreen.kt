package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/**
 * Native port of src/app/settings/hello-doc/page.tsx — Hello Doc: "Del din
 * fremgang med din læge eller diætist" (docs/DECISIONS.md 2026-09-12). Lists
 * the invited users; inviting requires the Seriøs subscription (2026-09-19).
 */
@Composable
fun SettingsHelloDocScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var shares by remember { mutableStateOf<List<SettingsHelloDocShareDto>?>(null) }
    var error by remember { mutableStateOf(false) }
    var isSerious by remember { mutableStateOf<Boolean?>(null) }

    LaunchedEffect(Unit) {
        try {
            shares = ApiJson.decodeFromJsonElement(SettingsHelloDocSharesResponse.serializer(), Api.get("/api/doctor-shares")).shares
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            error = true
        }
    }

    // Hello Doc requires Seriøs; a failed lookup does not lock the user out (web: null → true).
    LaunchedEffect(Unit) {
        isSerious = try {
            val tier = ((Api.get("/api/subscription") as? JsonObject)?.get("tier") as? JsonPrimitive)?.contentOrNull
            tier == "SERIOUS"
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            true
        }
    }

    HcScreen(title = t.t("helloDoc.title"), contentPadding = SettingsPagePadding) {
        SettingsPage(gap = HcDimens.SpaceSection) {
            HcText(t.t("helloDoc.subtitle"), HcTypeRoles.Body, color = HcColors.TextSecondary)

            val cardShape = RoundedCornerShape(HcDimens.RadiusCard)
            if (isSerious == false) {
                Box(
                    Modifier.fillMaxWidth().clip(cardShape).background(HcColors.Tan, cardShape)
                        .clickable { nav.push("/profile/subscription") }.padding(HcDimens.SpaceBlock),
                ) {
                    HcText(t.t("helloDoc.requiresSerious"), HcTypeRoles.Body)
                }
            } else {
                Row(
                    Modifier.fillMaxWidth().height(HcDimens.ControlHeight).clip(cardShape)
                        .background(HcColors.White, cardShape).border(1.dp, HcColors.FieldBorder, cardShape)
                        .clickable { nav.push("/settings/hello-doc/invite") }.padding(horizontal = HcDimens.SpaceBlock),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    HcText(t.t("helloDoc.inviteButton"), HcTypeRoles.Body, Modifier.weight(1f), maxLines = 1)
                    HcChevron()
                }
            }

            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
                HcSectionTitle(t.t("helloDoc.invitedUsersTitle"))

                val list = shares
                when {
                    error -> HcText(t.t("helloDoc.loadError"), HcTypeRoles.Body, color = HcColors.RedDark)
                    list == null -> HcLoader()
                    list.isEmpty() -> HcText(t.t("helloDoc.emptyInvited"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                    else -> Column(Modifier.fillMaxWidth()) {
                        for (share in list) {
                            HelloDocShareRow(share, onClick = { nav.push("/settings/hello-doc/${share.id}") })
                        }
                    }
                }
            }
        }
    }
}

/** hf-control-row: name + e-mail on the left, duration label on the right, line below. */
@Composable
private fun HelloDocShareRow(share: SettingsHelloDocShareDto, onClick: () -> Unit) {
    val t = LocalTranslator.current
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                HcText(share.name, HcTypeRoles.Body, maxLines = 1)
                HcText(share.email, HcTypeRoles.Caption, color = HcColors.TextSecondary, maxLines = 1)
            }
            HcText(
                SettingsHelloDoc.durationLabel(share, t),
                HcTypeRoles.Caption,
                Modifier.padding(start = 12.dp),
                color = HcColors.TextSecondary,
                maxLines = 1,
            )
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.Line))
    }
}

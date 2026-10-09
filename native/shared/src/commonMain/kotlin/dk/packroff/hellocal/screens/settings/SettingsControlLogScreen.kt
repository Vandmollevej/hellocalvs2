package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLink
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import dk.packroff.hellocal.ui.VSpace
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

// GET /api/family/access-log (src/app/api/family/access-log/route.ts).

@Serializable
data class SettingsControlLogPerson(
    val id: String,
    val displayName: String = "",
    val isOwner: Boolean = false,
    val canWrite: Boolean = false,
)

/** src/components/family/AccessLogEntryRow.tsx AccessLogEntry. */
@Serializable
data class SettingsControlLogEntry(
    val id: String,
    /** "OPENED" | "VIEWED" | "CREATED" | "UPDATED" | "DELETED" */
    val action: String = "",
    val area: String = "",
    val createdAt: String = "",
    val actorId: String = "",
    val actorName: String = "",
    val isSelf: Boolean = false,
)

@Serializable
data class SettingsControlLogData(
    val meId: String = "",
    val whoHasAccess: List<SettingsControlLogPerson> = emptyList(),
    val entries: List<SettingsControlLogEntry> = emptyList(),
)

/**
 * Native port of src/app/settings/control-log/page.tsx — Kontrol-log
 * (docs/FAMILY.md punkt 6): who can see/enter on the account, log-ins on the
 * account and everything others have done.
 */
@Composable
fun SettingsControlLogScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    var log by remember { mutableStateOf<SettingsControlLogData?>(null) }
    var failed by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        // The page shows everything, so the panel's "new events" are now seen.
        launch { runCatching { Api.post("/api/family/access-log") } }
        try {
            log = ApiJson.decodeFromJsonElement(SettingsControlLogData.serializer(), Api.get("/api/family/access-log"))
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            failed = true
        }
    }

    HcScreen(title = t.t("family.log.title"), contentPadding = SettingsPagePadding) {
        SettingsPage(gap = HcDimens.SpaceSection) {
            val data = log
            if (data == null) {
                if (failed) {
                    HcText(t.t("family.log.loadError"), HcTypeRoles.Body, Modifier.fillMaxWidth(), align = TextAlign.Center)
                } else {
                    HcLoader()
                }
            } else {
                Column(Modifier.fillMaxWidth()) {
                    HcSectionTitle(t.t("family.log.whoHasAccess"))
                    VSpace(HcDimens.SpaceBlock)
                    if (data.whoHasAccess.isEmpty()) {
                        HcText(t.t("family.log.nobody"), HcTypeRoles.Body)
                    } else {
                        val shape = RoundedCornerShape(HcDimens.RadiusCard)
                        Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
                            data.whoHasAccess.forEachIndexed { index, person ->
                                SettingsControlLogPersonRow(person, t, last = index == data.whoHasAccess.lastIndex)
                            }
                        }
                    }
                    HcLink(t.t("family.log.manage"), "/profile/family", Modifier.padding(top = 8.dp))
                }

                Column(Modifier.fillMaxWidth()) {
                    HcSectionTitle(t.t("family.log.eventsTitle"))
                    VSpace(HcDimens.SpaceBlock)
                    if (data.entries.isEmpty()) {
                        HcText(t.t("family.log.empty"), HcTypeRoles.Body)
                    } else {
                        val shape = RoundedCornerShape(HcDimens.RadiusCard)
                        Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Card, shape).padding(horizontal = HcDimens.SpaceBlock)) {
                            data.entries.forEachIndexed { index, entry ->
                                if (index > 0) HorizontalDivider(thickness = 1.dp, color = HcColors.TanDark)
                                SettingsControlLogEntryRow(entry, t)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsControlLogPersonRow(person: SettingsControlLogPerson, t: Translator, last: Boolean) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            SettingsControlLogProfileCircle(person.displayName)
            HcText(person.displayName, HcTypeRoles.Body, Modifier.weight(1f), maxLines = 1)
            HcText(
                when {
                    person.isOwner -> t.t("family.log.payer")
                    person.canWrite -> t.t("family.log.grantedWrite")
                    else -> t.t("family.log.grantedRead")
                },
                HcTypeRoles.Caption,
                color = HcColors.TextSecondary,
            )
        }
        if (!last) HorizontalDivider(thickness = 1.dp, color = HcColors.TanDark)
    }
}

/** src/components/family/AccessLogEntryRow.tsx — who, what and when. */
@Composable
private fun SettingsControlLogEntryRow(entry: SettingsControlLogEntry, t: Translator) {
    val whenText = settingsFormatShortDateTime(entry.createdAt, t.locale, settingsCopenhagenZone())
    val what = when {
        entry.area == "login" -> t.t("family.log.ownLogin")
        entry.action == "OPENED" -> t.t("family.log.action.OPENED")
        else -> "${t.t("family.log.action.${entry.action}")} · ${t.t("family.log.area.${entry.area}")}"
    }
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(Modifier.weight(1f)) {
            HcText(if (entry.isSelf) t.t("family.log.you") else entry.actorName, HcTypeRoles.Body)
            HcText(what, HcTypeRoles.Body, color = HcColors.TextSecondary)
        }
        HcText(whenText, HcTypeRoles.Caption, color = HcColors.TextSecondary)
    }
}

/** src/components/family/ProfileCircle.tsx with tone="card" (32 px, cream with a thin border). */
@Composable
private fun SettingsControlLogProfileCircle(name: String) =
    dk.packroff.hellocal.ui.ProfileCircle(name, tone = dk.packroff.hellocal.ui.ProfileCircleTone.Card)

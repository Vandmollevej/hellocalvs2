package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileCircle
import dk.packroff.hellocal.ui.ProfileCircleTone
import dk.packroff.hellocal.ui.ProfileEllipsisText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

// Family status (src/components/family/FamilyStatusProvider.tsx, GET /api/family).

@Serializable
data class FamilyProfile(val id: String, val displayName: String = "", val isChild: Boolean = false, val canWrite: Boolean = false)

@Serializable
data class FamilyMe(val id: String, val displayName: String = "")

@Serializable
data class FamilyInfo(val isOwner: Boolean = false)

@Serializable
data class FamilyStatus(
    val me: FamilyMe,
    /** Children can neither close the account nor leave the family — only a parent can. */
    val meIsChild: Boolean = false,
    val activeProfile: FamilyProfile,
    val profiles: List<FamilyProfile> = emptyList(),
    val family: FamilyInfo? = null,
    val hasFamilyPlan: Boolean = false,
) {
    val canManage: Boolean get() = family?.isOwner == true || (family == null && hasFamilyPlan)
}

object FamilyApi {
    suspend fun status(): FamilyStatus? = runCatching { ApiJson.decodeFromJsonElement(FamilyStatus.serializer(), Api.get("/api/family")) }.getOrNull()

    /** PUT /api/family/active-profile; every page then loads the chosen profile's data. */
    suspend fun switchProfile(profileId: String): Boolean = runCatching { Api.put("/api/family/active-profile", mapOf("profileId" to profileId)) }.isSuccess
}

/**
 * src/components/family/ProfileSwitcher.tsx — "Skift profil" at the top of
 * Profil: the profile circle with a bold "Skift profil" and an arrow; a tap
 * unfolds the list of profiles.
 */
@Composable
fun ProfileSwitcher(status: FamilyStatus?, onStatusChange: (FamilyStatus?) -> Unit) {
    val t = LocalTranslator.current
    var open by remember { mutableStateOf(false) }
    if (status == null) return
    if (status.profiles.size < 2 && !status.canManage) {
        Box(Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
            ProfileCircle(status.activeProfile.displayName, 96.dp, ProfileCircleTone.Brand)
        }
        return
    }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(
            Modifier.fillMaxWidth().padding(vertical = 8.dp).clickable { open = !open },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            ProfileCircle(status.activeProfile.displayName, 96.dp, ProfileCircleTone.Brand)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                HcText(t.t("family.switcher.title"), HcTypeRoles.Body, bold = true)
                HcChevron(if (open) ChevronDirection.Up else ChevronDirection.Down, color = HcColors.Black)
            }
            val caption = if (status.activeProfile.id == status.me.id) {
                t.t("family.switcher.you")
            } else {
                t.t(if (status.activeProfile.canWrite) "family.switcher.managing" else "family.switcher.viewing", "name" to status.activeProfile.displayName)
            }
            HcText(caption, HcTypeRoles.Caption, color = HcColors.TextSecondary)
        }
        if (open) {
            val shape = RoundedCornerShape(HcDimens.RadiusCard)
            Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
                ProfileSwitchList(status, onStatusChange, onDone = { open = false })
            }
        }
    }
}

/** ProfileSwitchList: the profiles to switch to, plus "Tilføj profil" and "Familie og adgang". */
@Composable
fun ProfileSwitchList(status: FamilyStatus, onStatusChange: (FamilyStatus?) -> Unit, onDone: () -> Unit) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var switching by remember { mutableStateOf<String?>(null) }

    fun choose(profileId: String) {
        if (profileId == status.activeProfile.id) {
            onDone()
            return
        }
        switching = profileId
        scope.launch {
            val ok = FamilyApi.switchProfile(profileId)
            if (ok) onStatusChange(FamilyApi.status())
            switching = null
            onDone()
            if (ok) nav.resetTo("/")
        }
    }

    Column(Modifier.fillMaxWidth()) {
        HorizontalDivider(thickness = 1.dp, color = HcColors.TanDark)
        status.profiles.forEach { profile ->
            Row(
                Modifier.fillMaxWidth().height(56.dp).clickable(enabled = switching == null) { choose(profile.id) }.padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                ProfileCircle(profile.displayName, 32.dp, ProfileCircleTone.Card)
                ProfileEllipsisText(
                    if (profile.id == status.me.id) t.t("family.switcher.meLabel", "name" to profile.displayName) else profile.displayName,
                    HcTypeRoles.Body,
                    Modifier.weight(1f),
                )
                if (profile.isChild) HcText(t.t("family.child"), HcTypeRoles.Caption, color = HcColors.TextSecondary)
                if (profile.id == status.activeProfile.id) HcIcon("Check", size = 20.dp, color = HcColors.Black)
            }
            HorizontalDivider(thickness = 1.dp, color = HcColors.TanDark)
        }
        if (status.canManage) {
            listOf("member", "child").forEach { kind ->
                AddRow(
                    icon = "Plus",
                    label = t.t(if (kind == "child") "family.add.addChild" else "family.add.addMember"),
                    onClick = {
                        onDone()
                        nav.push("/profile/family?add=$kind")
                    },
                )
            }
            AddRow(icon = "Mail", label = t.t("family.invite.title"), onClick = {
                onDone()
                nav.push("/profile/family?invite=1")
            })
        }
        Row(
            Modifier.fillMaxWidth().height(48.dp).clickable {
                onDone()
                nav.push("/profile/family")
            }.padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            HcIcon("Users", size = 20.dp, color = HcColors.Black)
            HcText(t.t("family.switcher.manage"), HcTypeRoles.Body, Modifier.weight(1f))
            HcChevron(color = HcColors.Black)
        }
    }
}

@Composable
private fun AddRow(icon: String, label: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().height(48.dp).clickable(onClick = onClick).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Box(Modifier.size(32.dp).clip(CircleShape).border(1.dp, HcColors.Black, CircleShape), contentAlignment = Alignment.Center) {
            HcIcon(icon, size = 16.dp, color = HcColors.Black)
        }
        HcText(label, HcTypeRoles.Body, Modifier.weight(1f))
    }
    HorizontalDivider(thickness = 1.dp, color = HcColors.TanDark)
}

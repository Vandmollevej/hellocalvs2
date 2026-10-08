package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.ProfileAccordionCard
import dk.packroff.hellocal.ui.ProfileBathScaleIcon
import dk.packroff.hellocal.ui.ProfileCenteredText
import dk.packroff.hellocal.ui.ProfileChevronRow
import dk.packroff.hellocal.ui.ProfileIcon
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import dk.packroff.hellocal.ui.ProfileProgressStepper
import dk.packroff.hellocal.ui.ProfileVectorIcon
import dk.packroff.hellocal.ui.ProfileWaistMeasureIcon
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

/** src/lib/account-setup.ts accountSetupDone: aboutYou, goals, habits. */
private fun accountSetupDone(user: ProfileUser): List<Boolean> = listOf(
    !user.sex.isNullOrEmpty() && !user.birthDate.isNullOrEmpty() && (user.heightCm ?: 0.0) != 0.0 && (user.weightKg ?: 0.0) != 0.0,
    !user.goalMode.isNullOrEmpty(),
    !user.activityLevel.isNullOrEmpty() && !user.defaultBedtime.isNullOrEmpty() && !user.defaultWakeTime.isNullOrEmpty(),
)

/** Native port of src/app/profile/page.tsx. */
@Composable
fun ProfileScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var user by remember { mutableStateOf<ProfileUser?>(null) }
    var loading by remember { mutableStateOf(true) }
    var showGuide by remember { mutableStateOf(false) }
    var unreadMessages by remember { mutableIntStateOf(0) }
    var family by remember { mutableStateOf<FamilyStatus?>(null) }

    LaunchedEffect(Unit) {
        coroutineScope {
            val messages = async {
                runCatching { (Api.get("/api/messages") as? JsonObject)?.get("unreadCount")?.jsonPrimitive?.intOrNull }.getOrNull()
            }
            val familyStatus = async { FamilyApi.status() }
            user = runCatching { ProfileApi.loadUser() }.getOrNull()
            loading = false
            messages.await()?.let { unreadMessages = it }
            family = familyStatus.await()
        }
    }

    // Members of a family (not the payer) get "Familie" at the top (owner's wish 2026-10-03).
    val isFamilyMember = family?.family != null && family?.family?.isOwner == false

    HcScreen(
        title = t.t("profile.title"),
        contentPadding = ProfilePagePadding,
        trailing = {
            Box(Modifier.size(44.dp).clickable { nav.push("/settings") }, contentAlignment = Alignment.Center) {
                HcIcon("Settings", size = 39.dp, stroke = 1.54f, color = HcColors.White, contentDescription = t.t("settings.openAppSettings"))
            }
        },
    ) {
        val current = user
        when {
            loading -> HcLoader()
            current == null -> ProfileCenteredText(t.t("profile.loadError"))
            else -> ProfilePage {
                if (showGuide) ProfileOnboardingWizard(forceVisible = true, onClose = { showGuide = false })
                val done = accountSetupDone(current)
                val setupComplete = done.all { it }
                // The progress line and the box stand at the very top until every field is set.
                if (!setupComplete) {
                    ProfileProgressStepper(
                        steps = listOf(t.t("profile.completion.aboutYou"), t.t("profile.completion.goals"), t.t("profile.completion.habits")),
                        current = done.indexOf(false).coerceAtLeast(0),
                        progress = 0f,
                    )
                    ProfileAccordionCard {
                        ProfileChevronRow(
                            label = t.t("settings.learnTheApp"),
                            onClick = { showGuide = true },
                            icon = { HcIcon("Refresh", size = 20.dp, color = HcColors.Black) },
                            divider = false,
                        )
                    }
                }
                if (isFamilyMember) {
                    ProfileAccordionCard {
                        ProfileChevronRow(
                            label = t.t("family.title"),
                            onClick = { nav.push("/profile/family") },
                            icon = { HcIcon("Users", size = 20.dp, color = HcColors.Black) },
                            divider = false,
                        )
                    }
                }
                ProfileSwitcher(family, onStatusChange = { family = it })
                ProfileAccordionCard {
                    ProfileChevronRow(t.t("profile.section.profile"), { nav.push("/profile/edit") }, { HcIcon("User", size = 20.dp, color = HcColors.Black) })
                    // Messages at the top under "Profil" with a green unread count (owner's choice 2026-10-03).
                    ProfileChevronRow(t.t("settings.messages"), { nav.push("/profile/messages") }, { HcIcon("Mail", size = 20.dp, color = HcColors.Black) }, badgeCount = unreadMessages)
                    ProfileChevronRow(t.t("profile.row.status"), { nav.push("/profile/status") }, { HcIcon("ChartLine", size = 20.dp, color = HcColors.Black) })
                    ProfileChevronRow(t.t("profile.row.points"), { nav.push("/profile/points") }, { HcIcon("Star", size = 20.dp, color = HcColors.Black) }, divider = false)
                }
                ProfileAccordionCard {
                    ProfileChevronRow(t.t("profile.row.weightCalibration"), { nav.push("/profile/weight-calibration") }, { ProfileBathScaleIcon(20.dp) })
                    ProfileChevronRow(t.t("profile.row.bodyMeasurements"), { nav.push("/profile/body-measurements") }, { ProfileWaistMeasureIcon(current.sex, 20.dp) })
                    ProfileChevronRow(t.t("profile.row.sleep"), { nav.push("/profile/sleep") }, { HcIcon("Moon", size = 20.dp, color = HcColors.Black) })
                    ProfileChevronRow(t.t("profile.row.photoDiary"), { nav.push("/profile/photo-diary") }, { ProfileIcon(ProfileVectorIcon.PhotoFrame, 20.dp) }, divider = false)
                }
                ProfileAccordionCard {
                    ProfileChevronRow(t.t("profile.row.recipes"), { nav.push("/profile/recipes") }, { ProfileIcon(ProfileVectorIcon.PlateCutlery, 20.dp) })
                    ProfileChevronRow(t.t("profile.row.knowledge"), { nav.push("/viden-om") }, { HcIcon("Book", size = 20.dp, color = HcColors.Black) })
                    ProfileChevronRow(t.t("settings.helloDoc"), { nav.push("/settings/hello-doc") }, { HcIcon("Stethoscope", size = 20.dp, color = HcColors.Black) }, divider = false)
                }
            }
        }
    }
}

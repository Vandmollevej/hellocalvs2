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
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.SettingsFrontPagePreview
import dk.packroff.hellocal.ui.SettingsGroupLabel
import dk.packroff.hellocal.ui.SettingsNamedIcon
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import dk.packroff.hellocal.ui.SettingsWheelIcon

/**
 * Native port of src/app/settings/display/front-page/page.tsx: which add
 * actions fill the joystick wheel, which edge the wheel sits on, and which
 * fields the number slider shows. All per-device (SettingsLocalPrefs).
 */
@Composable
fun FrontPageSettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    @Suppress("UNUSED_VARIABLE") val prefsVersion = SettingsLocalPrefs.version
    var sex by remember { mutableStateOf<String?>(null) }
    var cycleTrackingEnabled by remember { mutableStateOf(false) }

    // useAddActionsProfile(): sex + cycleTrackingEnabled from /api/profile.
    LaunchedEffect(Unit) {
        runCatching { settingsLoadProfile() }.getOrNull()?.let { user ->
            sex = user.settingsStr("sex")
            cycleTrackingEnabled = user.settingsBool("cycleTrackingEnabled") ?: false
        }
    }

    val actions = settingsVisibleAddActions(sex, cycleTrackingEnabled)
    val selectedKeys = SettingsLocalPrefs.wheelActionKeys()
    val fabSide = SettingsLocalPrefs.fabSide()
    val activeStatKeys = SettingsLocalPrefs.frontpageStatKeys()
    val max = SettingsLocalPrefs.MAX_WHEEL_ACTIONS
    val atMax = selectedKeys.size >= max

    fun toggleAction(key: String, checked: Boolean) {
        val current = selectedKeys.toMutableSet()
        if (checked) {
            if (current.size >= max) return
            current.add(key)
        } else {
            current.remove(key)
        }
        SettingsLocalPrefs.saveWheelActionKeys(actions.map { it.key }.filter { it in current })
    }

    fun toggleStat(key: String, checked: Boolean) {
        val current = activeStatKeys.toMutableSet()
        if (checked) current.add(key) else current.remove(key)
        SettingsLocalPrefs.saveFrontpageStatKeys(SETTINGS_FRONTPAGE_STATS.map { it.key }.filter { it in current })
    }

    fun sideLabel(side: String) = t.t(if (side == "left") "frontPageSettings.sideLeft" else "frontPageSettings.sideRight")

    HcScreen(title = t.t("settings.frontPage"), contentPadding = SettingsPagePadding) {
        SettingsPage {
            SettingsBrandCard(t.t("frontPageSettings.intro"))

            CustomMeasureSection()

            SettingsGroupLabel(t.t("frontPageSettings.sideSectionTitle"))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                listOf("left", "right").forEach { side ->
                    val isSelected = fabSide == side
                    val shape = RoundedCornerShape(16.dp)
                    Column(
                        Modifier.weight(1f).clip(shape)
                            .background(if (isSelected) HcColors.SelectedBg else HcColors.Tan, shape)
                            .let { if (isSelected) it.border(2.dp, HcColors.SelectedBorder, shape) else it }
                            .clickable { SettingsLocalPrefs.saveFabSide(side) }
                            .padding(vertical = 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        SettingsFrontPagePreview(side, isSelected)
                        HcText(sideLabel(side), HcTypeRoles.Body, bold = true, color = if (isSelected) HcColors.SelectedText else HcColors.Black)
                    }
                }
            }
            HcText(
                t.t("frontPageSettings.sideHint", "side" to sideLabel(SettingsLocalPrefs.oppositeSide(fabSide))),
                HcTypeRoles.Small,
                Modifier.padding(horizontal = 4.dp),
                color = HcColors.TextSecondary,
            )

            Row(Modifier.fillMaxWidth().padding(top = 8.dp, start = 4.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                SettingsWheelIcon()
                Box(Modifier.weight(1f).height(1.dp).alpha(0.25f).background(HcColors.Black))
                HcText(t.t("frontPageSettings.buttonsSectionTitle").uppercase(), HcTypeRoles.Small, bold = true, color = HcColors.TextSecondary)
                Box(Modifier.weight(1f).height(1.dp).alpha(0.25f).background(HcColors.Black))
            }
            HcText(
                t.t("frontPageSettings.selectedCount", "count" to selectedKeys.size, "max" to max),
                HcTypeRoles.Small,
                Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                color = HcColors.TextSecondary,
                bold = true,
                align = TextAlign.End,
            )

            SettingsToggleRows(
                count = actions.size,
                icon = { index ->
                    val action = actions[index]
                    if (action.icon != null) SettingsNamedIcon(action.icon, 20.dp)
                    else HcRemoteImage(action.imageSrc, Modifier.size(20.dp))
                },
                label = { index -> t.t(actions[index].labelKey) },
                checked = { index -> actions[index].key in selectedKeys },
                enabled = { index -> actions[index].key in selectedKeys || !atMax },
                onChange = { index, value -> toggleAction(actions[index].key, value) },
            )

            if (atMax) {
                HcText(t.t("frontPageSettings.maxReachedHint"), HcTypeRoles.Small, Modifier.padding(horizontal = 4.dp), color = HcColors.TextSecondary)
            }

            SettingsGroupLabel(t.t("frontPageSettings.statsSectionTitle"))
            HcText(t.t("frontPageSettings.statsIntro"), HcTypeRoles.Small, Modifier.padding(horizontal = 4.dp), color = HcColors.TextSecondary)

            SettingsToggleRows(
                count = SETTINGS_FRONTPAGE_STATS.size,
                icon = { index -> SettingsNamedIcon(SETTINGS_FRONTPAGE_STATS[index].icon, 20.dp) },
                label = { index -> t.t(SETTINGS_FRONTPAGE_STATS[index].labelKey) },
                checked = { index -> SETTINGS_FRONTPAGE_STATS[index].key in activeStatKeys },
                enabled = { true },
                onChange = { index, value -> toggleStat(SETTINGS_FRONTPAGE_STATS[index].key, value) },
            )
        }
    }
}

/** Tan rounded list of 48 px rows: 20 px icon, label, bare toggle; tan-dark dividers. */
@Composable
private fun SettingsToggleRows(
    count: Int,
    icon: @Composable (Int) -> Unit,
    label: (Int) -> String,
    checked: (Int) -> Boolean,
    enabled: (Int) -> Boolean,
    onChange: (Int, Boolean) -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
        for (index in 0 until count) {
            Row(
                Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) { icon(index) }
                HcText(label(index), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                HcToggle(checked(index), { onChange(index, it) }, enabled = enabled(index))
            }
            if (index < count - 1) HorizontalDivider(thickness = 1.dp, color = HcColors.TanDark)
        }
    }
}

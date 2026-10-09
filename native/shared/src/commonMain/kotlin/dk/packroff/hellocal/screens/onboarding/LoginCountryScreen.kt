package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon

/**
 * Native port of src/app/login/country/page.tsx. The choice is kept on the
 * device (not logged in yet) and sets the app language: Denmark → Danish,
 * everything else → English.
 */
@Composable
fun LoginCountryScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var selected by remember { mutableStateOf(readLoginCountry().flag) }

    fun choose(flag: String) {
        selected = flag
        storeLoginCountry(flag)
        OnboardingHooks.setLocale(localeForCountry(flag))
        nav.backTo("/login")
    }

    Column(Modifier.fillMaxSize().background(HcColors.Cream)) {
        HcAppBar(t.t("country.title"), onBack = { nav.backTo("/login") })
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) {
            for (country in LOGIN_COUNTRIES) {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 56.dp).clickable { choose(country.flag) }.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    HcRemoteImage("/flags/${country.flag}.png", Modifier.width(36.dp).height(27.dp).clip(RoundedCornerShape(2.dp)))
                    HcText(t.t("country.countries.${country.key}"), HcTypeRoles.Body, Modifier.weight(1f))
                    if (country.flag == selected) HcIcon("Check", size = 20.dp, stroke = 2.5f, color = HcColors.Green)
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.GrayBorder))
            }
        }
    }
}

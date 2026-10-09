package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.OnbRichText

/** Native port of src/app/om-os/page.tsx (plain white page, hard-coded Danish). */
@Composable
fun AboutScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val nav = LocalNavigator.current
    Column(
        Modifier.fillMaxSize().background(HcColors.White).statusBarsPadding().verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 576.dp).fillMaxWidth()) {
            HcText("← Forside", HcTypeRoles.Small, Modifier.clickable { nav.backTo("/") }, color = HcColors.Brand)
            HcText("Om Hello Cal", HcTypeRoles.Hero, Modifier.padding(top = 24.dp))
            HcText(
                "Hello Cal er en dansk app til kalorie- og måltidsregistrering. Vi vil gøre det nemt at holde styr på mad, vand og " +
                    "vægt, uden reklamer og med respekt for dine data.",
                HcTypeRoles.Body,
                Modifier.padding(top = 16.dp),
                color = HcColors.TextSecondary,
            )
            OnbRichText(
                "Kontakt: {support@hellocal.io|mailto:support@hellocal.io}",
                HcTypeRoles.Body,
                Modifier.padding(top = 16.dp),
                color = HcColors.TextSecondary,
                linkColor = HcColors.Brand,
            )
        }
    }
}

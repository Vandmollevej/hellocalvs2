package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Text
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.OnbHelloLoader
import kotlinx.coroutines.delay

/** Native port of src/app/welcome/page.tsx — 1.4 s splash, then hero with "Opret konto" / "Log ind". */
@Composable
fun WelcomeScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        delay(1400)
        loading = false
    }

    if (loading) {
        Column(
            Modifier.fillMaxSize().background(HcColors.Green).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(32.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            HcRemoteImage("/hello-cal-logo-white.png", Modifier.width(280.dp).height(90.dp), contentDescription = "Hello Cal")
            OnbHelloLoader()
        }
        return
    }

    Column(Modifier.fillMaxSize().background(HcColors.Cream)) {
        Row(
            Modifier.fillMaxWidth().background(HcColors.Green).statusBarsPadding().padding(horizontal = 16.dp).padding(bottom = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            HcRemoteImage("/hello-cal-logo-white.png", Modifier.width(130.dp).height(42.dp), contentDescription = "Hello Cal")
        }

        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(top = 16.dp)) {
            // The web's country chip is display-only here (DK); the picker lives on the login screen.
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                HcRemoteImage("/flag-denmark.png", Modifier.width(22.dp).height(16.dp).clip(RoundedCornerShape(2.dp)))
                HcText("DK", HcTypeRoles.Body)
                Box(Modifier.alpha(0.6f)) { HcChevron(ChevronDirection.Down, compact = true, color = HcColors.Black) }
            }

            Box(Modifier.fillMaxWidth().padding(top = 32.dp), contentAlignment = Alignment.Center) {
                // .hf-hero-circle: 180 px circle with a 3 px green ring.
                Box(Modifier.size(180.dp).clip(CircleShape).border(3.dp, HcColors.Green, CircleShape))
            }

            Text(
                text = buildAnnotatedString {
                    append(t.t("welcome.headline1"))
                    append("\n")
                    withStyle(SpanStyle(color = HcColors.Green)) { append(t.t("welcome.headline2")) }
                },
                modifier = Modifier.padding(top = 32.dp),
                style = HcTypeRoles.Hero.style(),
            )

            HcText(t.t("welcome.subtext"), HcTypeRoles.BodyLg, Modifier.padding(top = 32.dp))
        }

        // .hf-page: 16 px gap, padding 16 / gutter / 32.
        Column(
            Modifier.fillMaxWidth().padding(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection),
            verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock),
        ) {
            HcButton(t.t("welcome.signUp"), onClick = { nav.push("/signup") })
            HcButton(t.t("welcome.logIn"), onClick = { nav.push("/login") }, kind = HcButtonKind.Secondary)
        }
    }
}

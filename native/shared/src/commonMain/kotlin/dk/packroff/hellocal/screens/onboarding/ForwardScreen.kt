package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.HelloCalConfig
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcText

/**
 * Native port of src/app/forward/[token]/page.tsx ("Videresend ret/produkt til en ven", recipient side).
 *
 * The web page is a server component: it claims the forward and reads the
 * product/dish straight from the database (src/lib/forwards.ts claimForward),
 * and there is no /api route that does the same. Logged out, the native screen
 * behaves exactly like the web (log in first); logged in it opens the web page.
 * TODO(parity): needs GET /api/forwards/[token] (claim + item + sender + amountGrams)
 * to show "<ven> har sendt dig" and the add-to-today button natively.
 */
@Composable
fun ForwardScreen(args: RouteArgs) {
    val nav = LocalNavigator.current
    val token = args["token"]
    Column(
        Modifier.fillMaxSize().background(HcColors.Page).statusBarsPadding().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 384.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (Session.state != Session.State.LoggedIn) {
                HcText("Log ind for at se hvad din ven har sendt dig.", HcTypeRoles.Body, Modifier.fillMaxWidth(), align = TextAlign.Center)
                HcButton("Log ind", onClick = { nav.push("/login?next=/forward/$token") })
            } else {
                HcButton("Åbn i browseren", onClick = { NativeHooks.openExternalUrl("${HelloCalConfig.BASE_URL}/forward/$token") })
            }
        }
    }
}

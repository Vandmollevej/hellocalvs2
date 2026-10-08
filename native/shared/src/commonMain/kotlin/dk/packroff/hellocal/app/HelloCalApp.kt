package dk.packroff.hellocal.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.LoginResult
import dk.packroff.hellocal.api.NativeAuth
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.i18n.rememberTranslator
import dk.packroff.hellocal.nav.DeepLinks
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.Navigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.nav.Routes
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HelloCalTheme
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.VSpace

/** Root of the native app — the same on Android and iPhone. */
@Composable
fun HelloCalApp() {
    HelloCalTheme {
        val navigator = remember { Navigator(Location("/")) }
        var locale by remember { mutableStateOf(Locale.Default) }
        val translator = rememberTranslator(locale)

        LaunchedEffect(Unit) { Session.restore() }
        // The user's own app language (profile setting) once logged in.
        LaunchedEffect(Session.user?.appLocale) { locale = Locale.from(Session.user?.appLocale) }
        // Widgets/notifications/OAuth hand-off: hellocal://<path>.
        LaunchedEffect(Unit) {
            snapshotFlow { DeepLinks.pending }.collect { url ->
                if (url == null) return@collect
                if (Location.parse(url).path == NativeAuth.COMPLETE_PATH) {
                    // Google/Apple/Facebook login finished in the system browser.
                    completeOAuth(Location.parse(DeepLinks.consume()!!), navigator)
                } else if (Session.state == Session.State.LoggedIn) {
                    openDeepLink(DeepLinks.consume()!!, navigator)
                }
            }
        }
        LaunchedEffect(Session.state) {
            when (Session.state) {
                Session.State.LoggedOut -> if (Routes.resolve(navigator.current.path)?.first?.public != true) navigator.resetTo("/login")
                Session.State.LoggedIn -> {
                    if (navigator.current.path == "/login") navigator.resetTo("/")
                    DeepLinks.consume()?.let { openDeepLink(it, navigator) }
                }
                Session.State.Unknown -> Unit
            }
        }

        Box(Modifier.fillMaxSize().background(HcColors.Page)) {
            if (translator == null || Session.state == Session.State.Unknown) {
                HcLoader(Modifier.fillMaxSize())
            } else {
                CompositionLocalProvider(LocalTranslator provides translator, LocalNavigator provides navigator) {
                    BackHandler(enabled = navigator.stack.size > 1) { navigator.back() }
                    AppFrame(navigator)
                }
            }
        }
    }
}

/**
 * A deep link to the screen that is already open (e.g. the integration page
 * after hellocal://settings/integrations/<app>?connected=1) replaces it, so the
 * stack does not hold the same page twice.
 */
private fun openDeepLink(url: String, navigator: Navigator) {
    if (Location.parse(url).path == navigator.current.path) navigator.replace(url) else navigator.push(url)
}

/**
 * hellocal://auth/complete?code=… (or ?error=…) from the OAuth callback
 * (docs/DECISIONS.md 2026-10-08 "Native login-overdragelse"): trade the
 * one-time code for the session cookie, then continue to `next`.
 */
private suspend fun completeOAuth(location: Location, navigator: Navigator) {
    val code = location.query["code"]
    if (code == null) {
        if (Session.state != Session.State.LoggedIn) {
            navigator.resetTo("/login?error=" + Location.encode(location.query["error"] ?: "oauth"))
        }
        return
    }
    when (val result = NativeAuth.exchange(code)) {
        LoginResult.Success -> navigator.resetTo(location.query["next"]?.takeIf { it.startsWith("/") && !it.startsWith("//") } ?: "/")
        is LoginResult.Failed -> navigator.resetTo("/login?error=" + Location.encode(result.message))
        is LoginResult.ApprovalRequired -> Unit
    }
}

@Composable
private fun AppFrame(navigator: Navigator) {
    val location = navigator.current
    val resolved = Routes.resolve(location.path)
    Column(Modifier.fillMaxSize().imePadding()) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (resolved == null) {
                NotNativeYet(location)
            } else {
                val (route, params) = resolved
                route.content(RouteArgs(params, location.query, location.fragment))
            }
        }
        if (resolved?.first?.fullScreen != true && Session.state == Session.State.LoggedIn) {
            Box(Modifier.navigationBarsPadding()) { BottomNav(navigator) }
        }
    }
}

/**
 * Shown for a web route that has no native screen yet. native/parity/screens.json
 * lists every such route as "pending"; the parity check keeps the list honest.
 */
@Composable
private fun NotNativeYet(location: Location) {
    val nav = LocalNavigator.current
    HcScreen(title = "Hello Cal", back = nav.stack.size > 1) {
        VSpace(32.dp)
        HcText("Denne skærm er endnu ikke bygget i appen.", HcTypeRoles.Title, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        VSpace(8.dp)
        HcText(location.path, HcTypeRoles.Caption, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        VSpace(24.dp)
        HcButton("Åbn i browseren", onClick = {
            dk.packroff.hellocal.platform.NativeHooks.openExternalUrl(dk.packroff.hellocal.api.HelloCalConfig.BASE_URL + location.full)
        }, modifier = Modifier.padding(horizontal = 16.dp))
    }
}

package dk.packroff.hellocal.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import dk.packroff.hellocal.screens.food.AddMenuSheet
import dk.packroff.hellocal.screens.food.HomeFooterArc
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.setSingletonImageLoaderFactory
import coil3.network.ktor3.KtorNetworkFetcherFactory
import coil3.svg.SvgDecoder
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.LoginResult
import dk.packroff.hellocal.api.NativeAuth
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.AppLocale
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.rememberTranslator
import dk.packroff.hellocal.nav.DeepLinks
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.Navigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.nav.Routes
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.screens.onboarding.LOGIN_COUNTRY_KEY
import dk.packroff.hellocal.screens.onboarding.OnboardingHooks
import dk.packroff.hellocal.screens.onboarding.localeForCountry
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HelloCalTheme
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalCompactLandscape
import dk.packroff.hellocal.ui.VSpace
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.launch

/** web AuthGate PHONE_PATH: logged-in users without a phone number are sent here (DECISIONS 2026-10-02). */
private const val PHONE_PATH = "/account/phone"

/** Root of the native app — the same on Android and iPhone. */
@Composable
fun HelloCalApp() {
    // Images (incl. the payment logos, which are SVGs) load through the app's
    // own HTTP client, so they carry the session cookie like the web's <img>.
    setSingletonImageLoaderFactory { context ->
        ImageLoader.Builder(context)
            .components {
                add(KtorNetworkFetcherFactory(Api.client))
                add(SvgDecoder.Factory())
            }
            .build()
    }
    HelloCalTheme {
        val navigator = remember { Navigator(Location("/")) }
        // Language before login: the device's choice, else the stored login country
        // (Denmark → Danish, every other country → English). The country picker
        // switches it at once through OnboardingHooks.setLocale.
        remember {
            AppLocale.init { NativeHooks.secureStorage.get(LOGIN_COUNTRY_KEY)?.let { localeForCountry(it) } }
            OnboardingHooks.setLocale = { code -> AppLocale.set(code) }
            Unit
        }
        val translator = rememberTranslator(AppLocale.current)

        LaunchedEffect(Unit) { Session.restore() }
        // The user's own app language (profile setting) once logged in.
        LaunchedEffect(Session.user?.appLocale) {
            Session.user?.appLocale?.let { AppLocale.set(it, persist = false) }
        }
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
        // src/components/AuthGate.tsx: private pages need a login — without a
        // session the user is sent to the welcome page (the web shows its public
        // landing page on "/"; the app has none, so "/" goes to /welcome too).
        LaunchedEffect(Session.state) {
            when (Session.state) {
                Session.State.LoggedOut -> if (!isPublic(navigator.current.path)) navigator.resetTo("/welcome")
                Session.State.LoggedIn -> {
                    if (navigator.current.path == "/login" || navigator.current.path == "/welcome") navigator.resetTo("/")
                    DeepLinks.consume()?.let { openDeepLink(it, navigator) }
                }
                Session.State.Unknown -> Unit
            }
        }
        // AuthGate phone gate: logged in without a phone number → /account/phone?next=<page>, on every page change.
        LaunchedEffect(Session.state, Session.user?.phoneRequired, navigator.current.path) {
            val path = navigator.current.path
            if (Session.state == Session.State.LoggedIn && Session.user?.phoneRequired == true && path != PHONE_PATH && !isPublic(path)) {
                navigator.replace("$PHONE_PATH?next=" + Location.encode(path))
            }
        }

        Box(Modifier.fillMaxSize().background(HcColors.Page)) {
            val current = translator
            if (current == null || Session.state == Session.State.Unknown) {
                HcLoader(Modifier.fillMaxSize())
            } else {
                CompositionLocalProvider(LocalTranslator provides current, LocalNavigator provides navigator) {
                    BackHandler(enabled = navigator.stack.size > 1) { navigator.back() }
                    AppFrame(navigator)
                    // AuthGate: soft e-mail verification while the address is unconfirmed.
                    if (Session.state == Session.State.LoggedIn && Session.user?.emailVerified == false && !isPublic(navigator.current.path)) {
                        EmailVerifySheet()
                    }
                    // Connected integration that has not synced for a while: "Sync now".
                    if (Session.state == Session.State.LoggedIn && !isPublic(navigator.current.path)) {
                        StaleSyncPrompt(navigator.current.path)
                    }
                }
            }
        }
    }
}

/** AuthGate isPublicPath: the route is reachable without login (ScreenRoute.public). */
private fun isPublic(path: String): Boolean = Routes.resolve(path)?.first?.public == true

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
    val showNav = resolved?.first?.fullScreen != true && Session.state == Session.State.LoggedIn
    var footerMenuSheetOpen by remember { mutableStateOf(false) }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        // useIsCompactLandscape: "(orientation: landscape) and (max-height: 500px)".
        val compact = maxWidth > maxHeight && maxHeight <= 500.dp
        CompositionLocalProvider(LocalCompactLandscape provides compact) {
            Column(Modifier.fillMaxSize().imePadding()) {
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    if (resolved == null) {
                        NotNativeYet(location)
                    } else {
                        val (route, params) = resolved
                        route.content(RouteArgs(params, location.query, location.fragment))
                    }
                    // The bottom circle shows on every page with the bottom bar (user 2026-10-09).
                    if (showNav) {
                        HomeFooterArc(Modifier.align(Alignment.BottomCenter), onOpenMenuSheet = { footerMenuSheetOpen = true })
                    }
                }
                if (showNav) {
                    Box(Modifier.navigationBarsPadding()) { BottomNav(navigator) }
                }
            }
            if (footerMenuSheetOpen) AddMenuSheet(onClose = { footerMenuSheetOpen = false })
            // The bottom bar's edit panel lies over the page, like the web's absolute panel.
            if (showNav) BottomNavEditOverlay()
        }
    }
}

/** sessionStorage "hc_verify_email_banner_dismissed": closed for the rest of this app session. */
private object EmailVerifyState {
    var dismissed by mutableStateOf(false)
}

/**
 * src/components/EmailVerifySheet.tsx — soft e-mail verification
 * (docs/DECISIONS.md 2026-09-25) in the bottom sheet; dragging it down closes
 * it for this app session.
 */
@Composable
private fun EmailVerifySheet() {
    if (EmailVerifyState.dismissed) return
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf("idle") }

    fun resend() {
        status = "sending"
        scope.launch {
            status = if (runCatching { Api.post("/api/auth/verify-email/resend") }.isSuccess) "sent" else "error"
        }
    }

    HcBottomSheet(
        onDismiss = { EmailVerifyState.dismissed = true },
        title = t.t("verifyEmail.sheetTitle"),
        footer = {
            if (status != "sent") HcButton(t.t("verifyEmail.resend"), onClick = ::resend, enabled = status != "sending")
            HcText(t.t("verifyEmail.linkValidity"), HcTypeRoles.Small, Modifier.fillMaxWidth().padding(top = 12.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
        },
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Box(Modifier.size(80.dp).clip(CircleShape).background(HcColors.Tan), contentAlignment = Alignment.Center) {
                HcIcon("Mail", size = 40.dp, stroke = 1.6f, color = HcColors.Green)
            }
            HcText(
                when (status) {
                    "sent" -> t.t("verifyEmail.bannerSent")
                    "error" -> t.t("verifyEmail.bannerError")
                    else -> t.t("verifyEmail.sheetText")
                },
                HcTypeRoles.BodyLg,
                Modifier.fillMaxWidth(),
                align = TextAlign.Center,
            )
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
            NativeHooks.openExternalUrl(dk.packroff.hellocal.api.HelloCalConfig.BASE_URL + location.full)
        }, modifier = Modifier.padding(horizontal = 16.dp))
    }
}

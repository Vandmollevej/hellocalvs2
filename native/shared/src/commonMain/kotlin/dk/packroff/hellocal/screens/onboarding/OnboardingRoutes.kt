package dk.packroff.hellocal.screens.onboarding

import dk.packroff.hellocal.nav.ScreenRoute

/**
 * Login, onboarding & info pages. `public` follows PUBLIC_PREFIXES in
 * src/components/AuthGate.tsx; `fullScreen` = the web page has no HfScreen/BottomNav.
 */
object OnboardingRoutes {
    val routes = listOf(
        ScreenRoute("/signup", fullScreen = true, public = true) { SignupScreen(it) },
        ScreenRoute("/forgot-password", fullScreen = true, public = true) { ForgotPasswordScreen(it) },
        ScreenRoute("/reset-password", fullScreen = true, public = true) { ResetPasswordScreen(it) },
        ScreenRoute("/verify-email", fullScreen = true, public = true) { VerifyEmailScreen(it) },
        ScreenRoute("/welcome", fullScreen = true, public = true) { WelcomeScreen(it) },
        ScreenRoute("/login/country", fullScreen = true, public = true) { LoginCountryScreen(it) },
        ScreenRoute("/login/face-id", fullScreen = true, public = true) { FaceIdOfferScreen(it) },
        ScreenRoute("/approve-login") { ApproveLoginScreen(it) },
        ScreenRoute("/account/phone", fullScreen = true) { PhoneRequiredScreen(it) },
        ScreenRoute("/family-code", public = true) { FamilyCodeScreen(it) },
        ScreenRoute("/family-code/join", public = true) { FamilyJoinScreen(it) },
        ScreenRoute("/family-code/scan", public = true) { FamilyScanScreen(it) },
        ScreenRoute("/forward/[token]", fullScreen = true, public = true) { ForwardScreen(it) },
        ScreenRoute("/hello-doc/[token]", fullScreen = true, public = true) { HelloDocTokenScreen(it) },
        ScreenRoute("/betingelser", fullScreen = true, public = true) { TermsScreen(it) },
        ScreenRoute("/privatlivspolitik", fullScreen = true, public = true) { PrivacyScreen(it) },
        ScreenRoute("/om-os", fullScreen = true) { AboutScreen(it) },
        ScreenRoute("/presse", fullScreen = true, public = true) { PressScreen(it) },
        ScreenRoute("/mad-paa-latin", fullScreen = true) { FoodLatinScreen(it) },
        ScreenRoute("/vitaminer", fullScreen = true) { MicronutrientScreen(it) },
        ScreenRoute("/viden-om") { KnowledgeScreen(it) },
        ScreenRoute("/viden-om/[category]") { KnowledgeSectionScreen(it) },
        ScreenRoute("/viden-om/[category]/[slug]") { KnowledgeEntryScreen(it) },
        ScreenRoute("/viden-om/e-numre") { KnowledgeENumbersScreen(it) },
        ScreenRoute("/e-numre", fullScreen = true) { ENumberDirectoryScreen(it) },
        ScreenRoute("/e-numre/[code]") { ENumberDetailScreen(it) },
    )
}

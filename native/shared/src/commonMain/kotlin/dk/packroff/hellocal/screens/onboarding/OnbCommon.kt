package dk.packroff.hellocal.screens.onboarding

import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.HelloCalConfig
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.Navigator
import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

// Small helpers shared by the onboarding/login screens (web: src/lib/login-flow.ts,
// src/lib/login-country.ts, src/lib/phone.ts, src/lib/family-qr-path.ts).

/**
 * Platform hooks this area needs that are not in platform/NativeHooks yet.
 * The Android/iPhone apps fill these in at start-up (see the final report).
 * TODO(parity): move into platform/ as expect/actual once the shared owner adds them.
 */
object OnboardingHooks {
    /** Device supports passkeys/Face ID (web: isPasskeySupported). */
    var isPasskeySupported: () -> Boolean = { false }

    /** This device already has a passkey for the account (web: hasPasskeyOnDevice). */
    var hasPasskeyOnDevice: () -> Boolean = { false }

    /** Registers a passkey via /api/auth/passkey (web: registerPasskey); throws on failure/cancel. */
    var registerPasskey: (suspend () -> Unit)? = null

    /** Opens the camera and returns the text of the first QR code read, or null if cancelled. Throws if no camera. */
    var scanQrCode: (suspend () -> String?)? = null

    /** Changes the app language before login (web: setLocale from the country picker). */
    var setLocale: (String) -> Unit = {}
}

internal const val FACE_ID_DECLINED_KEY = "hc_face_id_declined"
internal const val LOGIN_COUNTRY_KEY = "hello-cal-login-country"

/** web: next.startsWith("/") && !next.startsWith("//") ? next : "/" */
internal fun safeNext(raw: String?): String {
    val next = raw ?: "/"
    return if (next.startsWith("/") && !next.startsWith("//")) next else "/"
}

internal fun markFaceIdDeclined() = NativeHooks.secureStorage.set(FACE_ID_DECLINED_KEY, "1")

/** web afterLoginPath(): offer Face ID once after a password/OAuth login on a supporting device. */
internal fun afterLoginPath(next: String): String {
    val target = safeNext(next)
    val declined = NativeHooks.secureStorage.get(FACE_ID_DECLINED_KEY) == "1"
    if (!OnboardingHooks.isPasskeySupported() || OnboardingHooks.hasPasskeyOnDevice() || declined) return target
    return "/login/face-id?next=" + Location.encode(target)
}

/**
 * web startOAuth(): Google/Apple/Facebook login runs in the system browser.
 * TODO(parity): return to the app after OAuth (needs an app-link callback, same as LoginScreen).
 */
internal fun startOAuth(provider: String, next: String) {
    NativeHooks.openExternalUrl(
        "${HelloCalConfig.BASE_URL}/api/auth/oauth/$provider?next=" + Location.encode(afterLoginPath(next)),
    )
}

/** The server's own `message` (web: data.message ?? fallback). */
internal fun ApiException.serverMessage(): String? =
    ((body as? JsonObject)?.get("message") as? JsonPrimitive)?.contentOrNull

/** `code` field of family API errors (web: t(`family.error.${data.code}`)). */
internal fun Throwable.familyErrorCode(): String =
    (((this as? ApiException)?.body as? JsonObject)?.get("code") as? JsonPrimitive)?.contentOrNull ?: "unknown"

/** web <Link href={x}> back links: pop when x is the previous screen, else replace. */
internal fun Navigator.backTo(href: String) {
    val target = Location.parse(href)
    if (stack.size > 1 && stack[stack.lastIndex - 1].path == target.path) back() else replace(href)
}

/** <Link href="/"> style back for pages opened directly (ScreenHeader.handleBack). */
internal fun Navigator.backOrHome() {
    if (!back()) replace("/")
}

// --- src/lib/login-country.ts --------------------------------------------

internal data class LoginCountry(val key: String, val flag: String, val code: String)

internal const val DEFAULT_LOGIN_COUNTRY = "denmark"

internal val LOGIN_COUNTRIES = listOf(
    LoginCountry("australien", "australia", "AU"),
    LoginCountry("belgien", "belgium", "BE"),
    LoginCountry("canada", "canada", "CA"),
    LoginCountry("danmark", "denmark", "DK"),
    LoginCountry("frankrig", "france", "FR"),
    LoginCountry("hollandEngelsk", "netherlands-english", "NL"),
    LoginCountry("irland", "ireland", "IE"),
    LoginCountry("italien", "italy", "IT"),
    LoginCountry("luxembourg", "luxembourg", "LU"),
    LoginCountry("nederlandene", "netherlands", "NL"),
    LoginCountry("newZealand", "new-zealand", "NZ"),
    LoginCountry("norge", "norway", "NO"),
    LoginCountry("schweiz", "switzerland", "CH"),
    LoginCountry("spanien", "spain", "ES"),
    LoginCountry("storbritannien", "united-kingdom", "GB"),
    LoginCountry("sverige", "sweden", "SE"),
    LoginCountry("tyskland", "germany", "DE"),
    LoginCountry("usa", "usa", "US"),
    LoginCountry("oestrig", "austria", "AT"),
)

internal fun findLoginCountry(flag: String?): LoginCountry =
    LOGIN_COUNTRIES.firstOrNull { it.flag == flag } ?: LOGIN_COUNTRIES.first { it.flag == DEFAULT_LOGIN_COUNTRY }

internal fun readLoginCountry(): LoginCountry = findLoginCountry(NativeHooks.secureStorage.get(LOGIN_COUNTRY_KEY))

internal fun storeLoginCountry(flag: String) = NativeHooks.secureStorage.set(LOGIN_COUNTRY_KEY, flag)

/** Denmark → Danish, every other country → English. */
internal fun localeForCountry(flag: String): String = if (flag == "denmark") "da" else "en"

// --- src/lib/phone.ts ----------------------------------------------------

private val COUNTRY_CALLING_CODES = mapOf(
    "DK" to "45", "SE" to "46", "NO" to "47", "FI" to "358", "IS" to "354",
    "DE" to "49", "GB" to "44", "NL" to "31", "US" to "1",
)
private const val DEFAULT_PHONE_REGION = "DK"
private val NATIONAL_LENGTHS = mapOf("45" to 8, "47" to 8, "354" to 7)

internal sealed interface PhoneValidation {
    data class Ok(val e164: String) : PhoneValidation
    data class Invalid(val reason: String) : PhoneValidation // "empty" | "invalid"
}

/** Normalises "+45 12 34 56 78", "0045 12345678", "12 34 56 78" (region DK) to E.164. */
internal fun validatePhone(input: String, region: String = DEFAULT_PHONE_REGION): PhoneValidation {
    val raw = input.trim()
    if (raw.isEmpty()) return PhoneValidation.Invalid("empty")
    if (!Regex("^[+\\d\\s().-]+$").matches(raw)) return PhoneValidation.Invalid("invalid")
    val compact = raw.replace(Regex("[\\s().-]+"), "")
    val digits: String
    if (compact.startsWith("+")) {
        if (compact.drop(1).contains('+')) return PhoneValidation.Invalid("invalid")
        digits = compact.drop(1).filter { it.isDigit() }
    } else if (compact.startsWith("00")) {
        digits = compact.drop(2).filter { it.isDigit() }
    } else {
        val national = compact.filter { it.isDigit() }
        val code = COUNTRY_CALLING_CODES[region.uppercase()] ?: COUNTRY_CALLING_CODES.getValue(DEFAULT_PHONE_REGION)
        val expected = NATIONAL_LENGTHS[code]
        val badLength = if (expected != null) national.length != expected else national.length < 4 || national.length > 14
        if (badLength) return PhoneValidation.Invalid("invalid")
        digits = code + national.trimStart('0')
    }
    if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return PhoneValidation.Invalid("invalid")
    return PhoneValidation.Ok("+$digits")
}

// --- src/lib/family-qr-path.ts -------------------------------------------

/** A family QR code is a link to /family-code/join?t=… or /family-code?t=…; anything else is rejected. */
internal fun familyPathFromQr(text: String): String? {
    val trimmed = text.trim()
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return null
    val afterScheme = trimmed.substringAfter("://")
    val pathAndQuery = "/" + afterScheme.substringAfter('/', "")
    val location = Location.parse(pathAndQuery)
    val token = location.query["t"]
    if (token.isNullOrEmpty() || (location.path != "/family-code" && location.path != "/family-code/join")) return null
    return location.path + "?t=" + Location.encode(token)
}

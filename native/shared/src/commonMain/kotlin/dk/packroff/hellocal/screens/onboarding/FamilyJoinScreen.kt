package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** GET /api/family/invite?t=… (previewFamilyInvite in src/lib/family.ts). */
@Serializable
internal data class FamilyInvite(
    val kind: String = "join",
    val ownerName: String = "",
    val email: String = "",
    val profiles: List<String>? = null,
)

/**
 * Native port of src/app/family-code/join/page.tsx — the page a scanned family
 * QR code opens (DECISIONS 2026-10-03). Joining requires being logged in to the
 * account with exactly the invited e-mail; the page is public so it can send
 * the user to login and back here.
 */
@Composable
fun FamilyJoinScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val token = args.opt("t") ?: ""
    var invite by remember(token) { mutableStateOf<FamilyInvite?>(null) }
    // The web uses undefined (not loaded yet) vs null (logged out); here `meLoaded` marks the first.
    var currentEmail by remember(token) { mutableStateOf<String?>(null) }
    var meLoaded by remember(token) { mutableStateOf(false) }
    var error by remember(token) { mutableStateOf(if (token.isEmpty()) t.t("family.joinPage.missing") else null) }
    var busy by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }
    var confirming by remember { mutableStateOf(false) }

    LaunchedEffect(token) {
        if (token.isEmpty()) return@LaunchedEffect
        val loaded = try {
            ApiJson.decodeFromJsonElement(FamilyInvite.serializer(), Api.get("/api/family/invite?t=" + Location.encode(token)))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            error = t.t("family.error.${e.familyErrorCode()}")
            return@LaunchedEffect
        }
        val me = if (Session.state == Session.State.LoggedIn) {
            runCatching { (Api.get("/api/auth/me").jsonObject["user"] as? JsonObject)?.get("email")?.jsonPrimitive?.contentOrNull }.getOrNull()
        } else {
            null
        }
        // A login code for a profile without login belongs on the password page.
        if (loaded.kind == "claim") {
            nav.replace("/family-code?t=" + Location.encode(token))
            return@LaunchedEffect
        }
        invite = loaded
        currentEmail = me
        meLoaded = true
    }

    fun doJoin() {
        error = null
        busy = true
        scope.launch {
            try {
                Api.post("/api/family/join", mapOf("token" to token))
                busy = false
                done = true
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                busy = false
                error = t.t("family.error.${e.familyErrorCode()}")
            }
        }
    }

    val here = "/family-code/join?t=" + Location.encode(token)
    val current = invite
    val sameAccount = current != null && currentEmail != null && currentEmail!!.trim().lowercase() == current.email

    HcScreen(title = t.t("family.joinPage.title"), contentPadding = FamilyPagePadding) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (current != null && !done) {
                HcText(t.t("family.joinPage.intro", "owner" to current.ownerName), HcTypeRoles.BodyLg)
                HcText(t.t("family.joinPage.emailInfo", "email" to current.email), HcTypeRoles.Body)
                val profiles = current.profiles
                if (!profiles.isNullOrEmpty()) {
                    HcText(t.t("family.joinPage.insight", "profiles" to profiles.joinToString(", ")), HcTypeRoles.Body)
                }
            }

            error?.let { HcText(it, HcTypeRoles.Body, color = HcColors.Danger) }

            if (current != null && !done && meLoaded && currentEmail == null) {
                HcText(t.t("family.joinPage.loginFirst", "email" to current.email), HcTypeRoles.Body)
                HcButton(t.t("family.joinPage.login"), onClick = { nav.push("/login?next=" + Location.encode(here)) })
                HcButton(
                    t.t("family.joinPage.signup"),
                    onClick = { nav.push("/signup?next=" + Location.encode(here)) },
                    kind = HcButtonKind.Secondary,
                )
            }

            if (current != null && !done && currentEmail != null && !sameAccount) {
                HcText(t.t("family.joinPage.wrongAccount", "current" to currentEmail!!, "email" to current.email), HcTypeRoles.Body)
                HcButton(
                    t.t("family.joinPage.logout"),
                    onClick = {
                        scope.launch {
                            Session.logout()
                            nav.push("/login?next=" + Location.encode(here))
                        }
                    },
                    kind = HcButtonKind.Secondary,
                )
            }

            if (current != null && !done && sameAccount) {
                HcButton(t.t("family.join.submit"), onClick = { confirming = true }, enabled = !busy)
            }

            if (current != null && done) {
                HcText(t.t("family.joinPage.done", "owner" to current.ownerName), HcTypeRoles.BodyLg)
                HcButton(t.t("family.joinPage.goToFamily"), onClick = { nav.push("/profile/family") })
            }
        }
    }

    // src/lib/use-confirm-sheet.tsx: confirmation as a bottom sheet, "Fortsæt" runs the action.
    if (confirming) {
        HcBottomSheet(onDismiss = { confirming = false }) {
            HcText(t.t("family.join.confirm"), HcTypeRoles.Body)
            dk.packroff.hellocal.ui.VSpace(12.dp)
            HcButton(t.t("common.continue"), onClick = {
                confirming = false
                doJoin()
            })
        }
    }
}

package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiException
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.app.BackHandler
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcError
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.ProfileCenteredText
import dk.packroff.hellocal.ui.ProfileFieldLabel
import dk.packroff.hellocal.ui.ProfileFilledField
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive

/** Native port of src/app/profile/change-password/page.tsx (src/components/ChangePasswordForm.tsx). */
@Composable
fun ChangePasswordScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    // field: currentPassword | newPassword | confirmPassword | form
    var error by remember { mutableStateOf<Pair<String, String>?>(null) }
    var success by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }

    fun errorFor(field: String) = error?.takeIf { it.first == field }?.second

    fun submit() {
        error = null
        success = false
        when {
            currentPassword.isEmpty() || newPassword.isEmpty() || confirmPassword.isEmpty() -> {
                error = "form" to t.t("profile.changePassword.requiredError")
                return
            }
            newPassword.length < 8 -> {
                error = "newPassword" to t.t("profile.changePassword.tooShortError")
                return
            }
            newPassword != confirmPassword -> {
                error = "confirmPassword" to t.t("profile.changePassword.mismatchError")
                return
            }
            currentPassword == newPassword -> {
                error = "newPassword" to t.t("profile.changePassword.sameError")
                return
            }
        }
        submitting = true
        scope.launch {
            try {
                Api.post("/api/profile/change-password", mapOf("currentPassword" to currentPassword, "newPassword" to newPassword))
                currentPassword = ""
                newPassword = ""
                confirmPassword = ""
                success = true
            } catch (e: ApiException) {
                val body = e.body as? JsonObject
                val field = body?.get("field")?.jsonPrimitive?.contentOrNull ?: "form"
                val message = body?.get("message")?.jsonPrimitive?.contentOrNull ?: t.t("profile.changePassword.genericError")
                error = field to message
            } catch (e: Exception) {
                error = "form" to t.t("profile.changePassword.networkError")
            } finally {
                submitting = false
            }
        }
    }

    HcScreen(title = t.t("profile.changePassword.title")) {
        if (Session.state != Session.State.LoggedIn) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                HcText(t.t("profile.changePassword.loginRequired"), HcTypeRoles.Body)
                HcButton(t.t("profile.changePassword.logIn"), onClick = { nav.push("/login?next=/profile/change-password") })
            }
        } else Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            HcTextField(currentPassword, { currentPassword = it }, label = t.t("profile.changePassword.currentLabel"), password = true)
            HcError(errorFor("currentPassword"))
            HcTextField(newPassword, { newPassword = it }, label = t.t("profile.changePassword.newLabel"), password = true)
            HcError(errorFor("newPassword"))
            HcTextField(confirmPassword, { confirmPassword = it }, label = t.t("profile.changePassword.confirmLabel"), password = true)
            HcError(errorFor("confirmPassword"))
            HcError(errorFor("form"))
            if (success) HcText(t.t("profile.changePassword.success"), HcTypeRoles.Caption, color = HcColors.GreenDark)
            HcButton(
                if (submitting) t.t("profile.changePassword.submitting") else t.t("profile.changePassword.submit"),
                onClick = ::submit,
                enabled = !submitting,
                modifier = Modifier.padding(top = 16.dp),
            )
        }
    }
}

/** Native port of src/app/profile/height/page.tsx — the "lock" page behind the locked height. */
@Composable
fun HeightLockScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    HcScreen(title = t.t("profile.height.lockTitle"), contentPadding = ProfilePagePadding) {
        ProfilePage {
            HcText(t.t("profile.height.lockBody"), HcTypeRoles.Body, color = HcColors.Black)
            HcButton(t.t("profile.height.goToIntegrations"), onClick = { nav.push("/settings/integrations") })
        }
    }
}

/** Native port of src/app/profile/start-weight/page.tsx — the start weight cannot be changed; go to daily weight. */
@Composable
fun StartWeightLockScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    HcScreen(title = t.t("profile.startWeight.lockTitle"), contentPadding = ProfilePagePadding) {
        ProfilePage {
            HcText(t.t("profile.startWeight.lockBody"), HcTypeRoles.Body, color = HcColors.Black)
            HcButton(t.t("profile.startWeight.setDailyWeight"), onClick = { nav.push("/profile/weight-calibration") })
        }
    }
}

/** Native port of src/app/profile/target-weight/page.tsx — the old page now redirects to Målsætning. */
@Composable
fun TargetWeightRedirectScreen(args: RouteArgs) {
    val nav = LocalNavigator.current
    LaunchedEffect(Unit) { nav.replace("/profile/goals") }
}

private const val PROFILE_HREF = "/profile/edit"
private const val MIN_KG = 25.0
private const val MAX_KG = 400.0

/**
 * Native port of src/app/profile/start-weight/verify/page.tsx — landing page
 * from the verification mail (only reachable by the link). The token is
 * checked by the server when shown and again on save.
 */
@Composable
fun StartWeightVerifyScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val token = args.opt("token") ?: ""
    val weightUnit = remember { ProfileUnits.current().weight }
    // loading | valid | invalid | saving | saved
    var state by remember(token) { mutableStateOf(if (token.isNotEmpty()) "loading" else "invalid") }
    var weight by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(token) {
        if (token.isEmpty()) return@LaunchedEffect
        state = try {
            val data = Api.get("/api/profile/start-weight?token=${Location.encode(token)}") as JsonObject
            if (data["valid"]?.jsonPrimitive?.booleanOrNull != true) {
                "invalid"
            } else {
                data["currentWeightKg"]?.jsonPrimitive?.doubleOrNull?.let { weight = ProfileUnits.weightToInputValue(it, weightUnit) }
                "valid"
            }
        } catch (e: Exception) {
            "invalid"
        }
    }

    fun save() {
        if (state == "saving") return
        val kg = ProfileUnits.parseWeightInput(weight, weightUnit)
        val parsed = kg?.let { round1(it) }
        if (parsed == null || parsed < MIN_KG || parsed > MAX_KG) {
            error = t.t("profile.startWeight.invalidWeight")
            return
        }
        error = null
        state = "saving"
        scope.launch {
            try {
                Api.post("/api/profile/start-weight", mapOf("token" to token, "weightKg" to parsed))
                state = "saved"
            } catch (e: ApiException) {
                val code = (e.body as? JsonObject)?.get("code")?.jsonPrimitive?.contentOrNull
                if (code == "invalid_token") {
                    state = "invalid"
                } else {
                    error = t.t(if (code == "invalid_weight") "profile.startWeight.invalidWeight" else "profile.startWeight.saveError")
                    state = "valid"
                }
            } catch (e: Exception) {
                error = t.t("profile.startWeight.saveError")
                state = "valid"
            }
        }
    }

    val back = { nav.replace(PROFILE_HREF) }
    BackHandler(enabled = true) { back() }
    val title = if (state == "saved") t.t("profile.startWeight.title") else t.t("profile.startWeight.changeTitle")
    Column(Modifier.fillMaxSize().background(HcColors.Cream)) {
        HcAppBar(title, onBack = back)
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(ProfilePagePadding)) {
            when (state) {
                "loading" -> ProfileCenteredText(t.t("profile.startWeight.validating"))
                "invalid" -> ProfilePage {
                    HcText(t.t("profile.startWeight.invalidLinkTitle"), HcTypeRoles.Title, color = HcColors.Black)
                    HcText(t.t("profile.startWeight.invalidLinkBody"), HcTypeRoles.Body, color = HcColors.Black)
                    HcButton(t.t("profile.startWeight.backToApp"), onClick = back, kind = HcButtonKind.Brand, modifier = Modifier.padding(top = 8.dp))
                }
                "saved" -> ProfilePage {
                    HcText(t.t("profile.startWeight.saved"), HcTypeRoles.Title, color = HcColors.Black)
                    HcButton(t.t("profile.startWeight.backToApp"), onClick = back, kind = HcButtonKind.Brand, modifier = Modifier.padding(top = 8.dp))
                }
                else -> ProfilePage {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProfileFieldLabel(t.t("profile.startWeight.fieldLabel"))
                        ProfileFilledField(
                            weight,
                            { weight = it },
                            Modifier.fillMaxWidth(),
                            enabled = state != "saving",
                            keyboardType = if (weightUnit == WeightUnit.St) KeyboardType.Text else KeyboardType.Decimal,
                            suffix = ProfileUnits.weightUnitLabel(weightUnit).uppercase(),
                        )
                    }
                    HcError(error)
                    HcButton(
                        if (state == "saving") t.t("profile.startWeight.saving") else t.t("profile.startWeight.save"),
                        onClick = ::save,
                        kind = HcButtonKind.Brand,
                        enabled = state != "saving",
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            }
        }
    }
}

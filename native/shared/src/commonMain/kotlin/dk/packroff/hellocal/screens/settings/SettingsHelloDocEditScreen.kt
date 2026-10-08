package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.api.HelloCalConfig
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import dk.packroff.hellocal.ui.VSpace
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement

/**
 * Native port of src/app/settings/hello-doc/[id]/page.tsx — the "already
 * invited user" screen: adjust shared categories/history range, renew an
 * expired/revoked access, or revoke access.
 */
@Composable
fun SettingsHelloDocEditScreen(args: RouteArgs) {
    val id = args["id"]
    // Fresh state per share (the same screen can be reopened with another id).
    key(id) { HelloDocEditContent(id) }
}

@Composable
private fun HelloDocEditContent(id: String) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()

    var share by remember { mutableStateOf<SettingsHelloDocShareDto?>(null) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var categories by remember { mutableStateOf(SettingsHelloDoc.DefaultCategories) }
    var historyRange by remember { mutableStateOf("ALL") }
    var loadError by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var renewing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var confirmRevoke by remember { mutableStateOf(false) }

    val path = "/api/doctor-shares/$id"

    fun decodeShare(json: JsonElement): SettingsHelloDocShareDto =
        ApiJson.decodeFromJsonElement(SettingsHelloDocShareResponse.serializer(), json).share

    LaunchedEffect(id) {
        try {
            val loaded = decodeShare(Api.get(path))
            share = loaded
            name = loaded.name
            email = loaded.email
            categories = SettingsHelloDoc.sanitizeCategories(loaded.categories)
            historyRange = loaded.historyRange
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            loadError = true
        }
    }

    fun saveChanges() {
        saving = true
        error = null
        scope.launch {
            try {
                share = decodeShare(
                    Api.patch(path, mapOf("name" to name, "email" to email, "categories" to categories, "historyRange" to historyRange)),
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = SettingsHelloDoc.errorMessage(e, t.t("helloDoc.errorGeneric"))
            } finally {
                saving = false
            }
        }
    }

    fun renew() {
        renewing = true
        error = null
        scope.launch {
            try {
                share = decodeShare(Api.post("$path/renew"))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = SettingsHelloDoc.errorMessage(e, t.t("helloDoc.errorGeneric"))
            } finally {
                renewing = false
            }
        }
    }

    fun revoke() {
        scope.launch {
            // web: only updates the share when the request succeeded.
            runCatching { decodeShare(Api.post("$path/revoke")) }.onSuccess { share = it }
        }
    }

    if (loadError) {
        HcScreen(title = t.t("helloDoc.editTitle"), contentPadding = SettingsPagePadding) {
            HcText(t.t("helloDoc.loadError"), HcTypeRoles.Body, color = HcColors.RedDark)
        }
        return
    }

    val current = share
    if (current == null) {
        HcScreen(title = t.t("helloDoc.editTitle"), contentPadding = SettingsPagePadding) {
            HcLoader()
        }
        return
    }

    HcScreen(
        title = t.t("helloDoc.editTitle"),
        contentPadding = SettingsPagePadding,
        bottom = {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline)) {
                HcButton(
                    label = if (saving) t.t("helloDoc.sending") else t.t("helloDoc.saveChanges"),
                    onClick = ::saveChanges,
                    enabled = !saving && name.isNotBlank() && email.isNotBlank(),
                )
                val message = error
                if (message != null) {
                    HcText(message, HcTypeRoles.Caption, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center)
                }
            }
        },
    ) {
        SettingsPage(gap = HcDimens.SpaceSection) {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock)) {
                HcSectionTitle(SettingsHelloDoc.durationLabel(current, t))
                if (SettingsHelloDoc.hasAccess(current)) {
                    HcButton(label = t.t("helloDoc.revoke"), onClick = { confirmRevoke = true }, kind = HcButtonKind.Danger)
                } else {
                    HcButton(
                        label = if (renewing) t.t("helloDoc.renewing") else t.t("helloDoc.renew"),
                        onClick = ::renew,
                        enabled = !renewing,
                    )
                }
            }

            SettingsHelloDocEditor(
                name = name,
                onNameChange = { name = it },
                email = email,
                onEmailChange = { email = it },
                categories = categories,
                onCategoriesChange = { categories = it },
                historyRange = historyRange,
                onHistoryRangeChange = { historyRange = it },
                // web: <Link href="/hello-doc/{token}" target="_blank"> — the recipient's view, outside the app.
                onPreview = { NativeHooks.openExternalUrl("${HelloCalConfig.BASE_URL}/hello-doc/${current.token}") },
            )
        }
    }

    // web: window.confirm(t("helloDoc.revokeConfirm", { name }))
    if (confirmRevoke) {
        HcBottomSheet(onDismiss = { confirmRevoke = false }) {
            HcText(t.t("helloDoc.revokeConfirm", "name" to current.name), HcTypeRoles.Body, Modifier.padding(bottom = HcDimens.SpaceBlock))
            HcButton(
                label = t.t("helloDoc.revoke"),
                onClick = {
                    confirmRevoke = false
                    revoke()
                },
                kind = HcButtonKind.Danger,
            )
            VSpace(HcDimens.SpaceInline)
            HcButton(label = t.t("common.cancel"), onClick = { confirmRevoke = false }, kind = HcButtonKind.Secondary)
        }
    }
}

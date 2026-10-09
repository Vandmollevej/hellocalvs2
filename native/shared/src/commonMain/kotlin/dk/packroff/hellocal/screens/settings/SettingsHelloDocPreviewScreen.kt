package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsHelloDocInsight
import dk.packroff.hellocal.ui.SettingsHelloDocInsightData
import dk.packroff.hellocal.ui.SettingsHelloDocInsightGoals
import dk.packroff.hellocal.ui.SettingsHelloDocInsightWeight
import dk.packroff.hellocal.ui.SettingsHelloDocSleep
import dk.packroff.hellocal.ui.SettingsPagePadding
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.CancellationException
import dk.packroff.hellocal.ui.HelloDocDashboardMenu
import dk.packroff.hellocal.ui.rememberHelloDocDashboardLayout
import kotlinx.coroutines.launch

/**
 * Native port of src/app/settings/hello-doc/preview/page.tsx — "Sådan ser det
 * ud" (docs/DECISIONS.md 2026-09-12): the signed-in owner's own data in the
 * layout a Hello Doc recipient sees. Full screen with its own white top bar
 * (no green app bar, no bottom navigation).
 */
@Composable
fun SettingsHelloDocPreviewScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()

    var data by remember { mutableStateOf<SettingsHelloDocPreviewDto?>(null) }
    var error by remember { mutableStateOf(false) }
    var range by remember { mutableStateOf("ALL") }
    val layout = rememberHelloDocDashboardLayout()

    LaunchedEffect(range) {
        try {
            data = ApiJson.decodeFromJsonElement(SettingsHelloDocPreviewDto.serializer(), Api.get("/api/doctor-shares/preview?range=$range"))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            error = true
        }
    }

    fun logOut() {
        scope.launch {
            Session.logout()
            nav.resetTo("/login")
        }
    }

    Column(Modifier.fillMaxSize().background(HcColors.White).navigationBarsPadding()) {
        // .hf-shell__topbar: white bar, nav-coloured line below.
        Row(
            Modifier.fillMaxWidth().background(HcColors.Surface).statusBarsPadding().height(56.dp).padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Box(
                Modifier.size(44.dp).clip(CircleShape).clickable { nav.back() },
                contentAlignment = Alignment.Center,
            ) {
                HcIcon("ChevronLeft", size = 22.dp, stroke = 2.5f, color = HcColors.Black, contentDescription = t.t("common.back"))
            }
            HcText("Hello Doc", HcTypeRoles.Title)
            HelloDocDashboardMenu(layout) { close ->
                // Hjælp has no action on the web yet either.
                HelloDocPreviewMenuRow(t.t("helloDoc.preview.menuHelp"), onClick = {})
                HelloDocPreviewMenuRow(t.t("helloDoc.preview.menuMyDetails"), onClick = {
                    close()
                    nav.push("/profile/edit")
                })
                HelloDocPreviewMenuRow(t.t("helloDoc.preview.menuLogout"), onClick = ::logOut, color = HcColors.RedDark)
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.Nav))

        // Mock address bar: lock + "hellocal.io/hello-doc/••••••••••••".
        Row(
            Modifier.fillMaxWidth().background(HcColors.Cream).padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline),
        ) {
            HcIcon("Lock", size = 14.dp, stroke = 2.5f, color = HcColors.TextSecondary)
            HcText(t.t("helloDoc.previewAddress") + "••••••••••••", HcTypeRoles.Caption, Modifier.weight(1f), color = HcColors.TextSecondary, maxLines = 1)
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.Line))

        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) {
            if (error) {
                HcText(t.t("helloDoc.loadError"), HcTypeRoles.Body, Modifier.padding(16.dp), color = HcColors.RedDark)
            }

            val loaded = data
            if (!error && loaded == null) HcLoader()

            if (loaded != null) {
                Column(
                    Modifier.fillMaxWidth().padding(SettingsPagePadding),
                    verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceSection),
                ) {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopEnd) {
                        SettingsHelloDocRangeSelect(
                            value = range,
                            onChange = { range = it },
                            modifier = Modifier.width(192.dp),
                            compact = true,
                        )
                    }
                    SettingsHelloDocInsight(
                        SettingsHelloDocInsightData(
                            profile = loaded.profile,
                            weight = SettingsHelloDocInsightWeight(loaded.startWeightKg, loaded.startWeightRecordedAt, loaded.weightHistory),
                            goals = SettingsHelloDocInsightGoals(loaded.targetWeightKg),
                            sleep = loaded.sleep ?: SettingsHelloDocSleep(),
                            dailyNutrition = loaded.dailyNutrition,
                            fluidHistory = loaded.fluidHistory,
                        ),
                        layout = layout,
                    )
                }
            }
        }
    }
}

/** .hf-navrow.hf-control-row inside the .hf-menu dropdown. */
@Composable
private fun HelloDocPreviewMenuRow(label: String, onClick: () -> Unit, color: Color = HcColors.TextSecondary) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clip(RoundedCornerShape(HcDimens.RadiusCard))
            .clickable(onClick = onClick).padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        HcText(label, HcTypeRoles.Body, color = color)
    }
}

package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding

/** src/lib/migration-sources.ts MIGRATION_SOURCES: slug (page address), value (MigrationImport.source), label. */
internal class SettingsMigrationSource(val slug: String, val value: String, val label: String)

internal val SETTINGS_MIGRATION_SOURCES = listOf(
    SettingsMigrationSource("myfitnesspal", "MYFITNESSPAL", "MyFitnessPal"),
    SettingsMigrationSource("lifesum", "LIFESUM", "Lifesum"),
)

/**
 * Native port of src/app/settings/import/page.tsx — Import (docs/DECISIONS.md
 * 2026-10-15): choose the app to move from; other apps go to the contact form
 * with the subject filled in. The recording itself is SettingsImportProviderScreen.
 */
@Composable
fun SettingsImportScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val contactPath = "/settings/support/contact?category=DATA&subject=" + Location.encode(t.t("migrationImport.contactSubject"))

    HcScreen(
        title = t.t("migrationImport.landingTitle"),
        contentPadding = SettingsPagePadding,
        bottom = {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline)) {
                SETTINGS_MIGRATION_SOURCES.forEach { source ->
                    HcButton(source.label, onClick = { nav.push("/settings/import/${source.slug}") })
                }
            }
        },
    ) {
        SettingsPage(gap = HcDimens.SpaceBlock) {
            HcText(t.t("migrationImport.landingIntro"), HcTypeRoles.Body, color = HcColors.Black)
            HcText(t.t("migrationImport.otherProvider"), HcTypeRoles.Body, color = HcColors.TextSecondary)
            HcButton(t.t("migrationImport.contactUs"), onClick = { nav.push(contactPath) }, kind = HcButtonKind.Text)
        }
    }
}

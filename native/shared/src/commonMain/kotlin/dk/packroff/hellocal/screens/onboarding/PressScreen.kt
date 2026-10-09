package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.material3.Text
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.HelloCalConfig
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

// src/lib/subscription-plans.ts SUBSCRIPTION_PRICES_DKK[plan][1].
private const val SERIOUS_MONTHLY_DKK = 119
private const val FAMILY_MONTHLY_DKK = 179

private val PRESS_FACTS = listOf(
    "Hvad" to "Dansk app til kalorie- og måltidsregistrering",
    "Platforme" to "iPhone (App Store) og Android (Google Play)",
    "Pris" to "Gratis · Seriøs $SERIOUS_MONTHLY_DKK kr./md. · Seriøs Familie $FAMILY_MONTHLY_DKK kr./md.",
    "Data" to "Brugernes data bruges kun til at levere appen — aldrig til annoncer",
)

private data class PressLogo(val src: String, val label: String, val dark: Boolean)

private val PRESS_LOGOS = listOf(
    PressLogo("/hello-cal-logo.png", "Logo — grøn", dark = false),
    PressLogo("/hello-cal-logo-white.png", "Logo — hvid", dark = true),
)

/**
 * Native port of src/app/presse/page.tsx inside src/components/landing/MarketingShell.tsx
 * (header with logo + "Log ind", hero, facts, logos, contact, footer).
 */
@Composable
fun PressScreen(@Suppress("UNUSED_PARAMETER") args: RouteArgs) {
    val nav = LocalNavigator.current
    Column(Modifier.fillMaxSize().background(HcColors.White)) {
        // Marketing header: logo left, "Log ind" pill right.
        Row(
            Modifier.fillMaxWidth().background(HcColors.White).statusBarsPadding().height(72.dp).padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            HcRemoteImage("/hello-cal-logo.png", Modifier.width(132.dp).height(44.dp).clickable { nav.backTo("/") }, contentDescription = "Hello Cal")
            Spacer(Modifier.weight(1f))
            Box(
                Modifier.clip(RoundedCornerShape(50)).background(HcColors.Green).clickable { nav.push("/login") }
                    .padding(horizontal = 24.dp, vertical = 10.dp),
            ) {
                HcText("Log ind", HcTypeRoles.Small, color = HcColors.White, bold = true)
            }
        }

        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) {
            // Hero (.mk-hero-bg).
            Column(
                Modifier.fillMaxWidth()
                    .background(Brush.linearGradient(listOf(HcColors.MkBrandLight, HcColors.Brand, HcColors.BrandDark)))
                    .padding(horizontal = 16.dp, vertical = 80.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                HcText("PRESSE", HcTypeRoles.Small, color = HcColors.GreenLight, bold = true, align = TextAlign.Center)
                HcText("Hello Cal til pressen", HcTypeRoles.Hero, Modifier.padding(top = 16.dp), color = HcColors.White, align = TextAlign.Center)
                HcText(
                    "Fakta, logoer og kontakt til dig, der skriver om Hello Cal.",
                    HcTypeRoles.BodyLg,
                    Modifier.padding(top = 24.dp).alpha(0.85f),
                    color = HcColors.White,
                    align = TextAlign.Center,
                )
            }

            MarketingSection(HcColors.White) {
                SectionHeading("Fakta om", accent = "Hello Cal")
                Column(Modifier.padding(top = 40.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    for ((label, value) in PRESS_FACTS) {
                        Column(
                            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.Cream).padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            HcText(label, HcTypeRoles.Body, bold = true, color = HcColors.Black)
                            HcText(value, HcTypeRoles.Body, color = HcColors.TextSecondary)
                        }
                    }
                }
            }

            MarketingSection(HcColors.Tan) {
                SectionHeading("Logoer", text = "Må bruges i omtale af Hello Cal. Undlad at ændre farver eller proportioner.")
                Column(Modifier.padding(top = 40.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    for (logo in PRESS_LOGOS) {
                        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.White)) {
                            Box(
                                Modifier.fillMaxWidth().height(160.dp).background(if (logo.dark) HcColors.Green else HcColors.White),
                                contentAlignment = Alignment.Center,
                            ) {
                                HcRemoteImage(logo.src, Modifier.width(176.dp).height(58.dp))
                            }
                            Row(
                                Modifier.fillMaxWidth().clickable { NativeHooks.openExternalUrl(HelloCalConfig.BASE_URL + logo.src) }.padding(16.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                HcIcon("Download", size = 18.dp, color = HcColors.Green)
                                HcText("${logo.label} (PNG)", HcTypeRoles.Small, bold = true, color = HcColors.Green)
                            }
                        }
                    }
                }
            }

            MarketingSection(HcColors.White) {
                SectionHeading("Pressekontakt", text = "Skriv til os via kontaktformularen — vælg emnet Presse.")
                Box(Modifier.fillMaxWidth().padding(top = 32.dp), contentAlignment = Alignment.Center) {
                    Box(
                        Modifier.clip(RoundedCornerShape(50)).background(HcColors.Brand)
                            .clickable { nav.push("/business?emne=press") }
                            .padding(horizontal = 32.dp, vertical = 12.dp),
                    ) {
                        HcText("Kontakt os", HcTypeRoles.Button, color = HcColors.White)
                    }
                }
            }

            MarketingFooter()
        }
    }
}

@Composable
private fun MarketingSection(background: Color, content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxWidth().background(background).padding(horizontal = 16.dp, vertical = 80.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 768.dp).fillMaxWidth(), content = content)
    }
}

/** MarketingShell.tsx SectionHeading: bold centred title with a green accent word, optional intro. */
@Composable
private fun SectionHeading(title: String, accent: String? = null, text: String? = null) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = buildAnnotatedString {
                append(title)
                if (accent != null) {
                    append(" ")
                    withStyle(SpanStyle(color = HcColors.Green)) { append(accent) }
                }
            },
            style = HcTypeRoles.PageTitle.style(HcColors.Black),
            textAlign = TextAlign.Center,
        )
        if (text != null) {
            HcText(text, HcTypeRoles.Body, Modifier.padding(top = 16.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
        }
    }
}

/** MarketingShell.tsx MarketingFooter. */
@Composable
private fun MarketingFooter() {
    val nav = LocalNavigator.current
    val year = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault()).year
    Column(Modifier.fillMaxWidth().background(HcColors.GreenDark)) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 56.dp), verticalArrangement = Arrangement.spacedBy(40.dp)) {
            Column {
                HcRemoteImage("/hello-cal-logo-white.png", Modifier.width(132.dp).height(44.dp), contentDescription = "Hello Cal")
                HcText(
                    "Kalorier, måltider, vand og vægt — nemt, hurtigt og på dansk.",
                    HcTypeRoles.Small,
                    Modifier.padding(top = 16.dp).alpha(0.75f),
                    color = HcColors.White,
                )
            }
            FooterLinks("FOR VIRKSOMHEDER", listOf("Business-partnere" to "/business", "Presse" to "/presse")) { nav.push(it) }
            FooterLinks(
                "HELLO CAL",
                listOf("Log ind" to "/login", "Vilkår og betingelser" to "/betingelser", "Privatlivspolitik" to "/privatlivspolitik"),
            ) { nav.push(it) }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.White.copy(alpha = 0.1f)))
        HcText("© $year Hello Cal", HcTypeRoles.Micro, Modifier.padding(horizontal = 16.dp, vertical = 20.dp).alpha(0.6f), color = HcColors.White)
    }
}

@Composable
private fun FooterLinks(title: String, links: List<Pair<String, String>>, onOpen: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HcText(title, HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), color = HcColors.GreenLight, bold = true)
        for ((label, href) in links) {
            HcText(label, HcTypeRoles.Small, Modifier.clickable { onOpen(href) }.alpha(0.85f), color = HcColors.White)
        }
    }
}

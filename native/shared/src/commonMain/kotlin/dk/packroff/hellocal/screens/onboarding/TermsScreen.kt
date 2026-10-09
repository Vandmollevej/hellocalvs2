package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalOnbLegalAnchor
import dk.packroff.hellocal.ui.OnbLegalAnchor
import dk.packroff.hellocal.ui.OnbBulletList
import dk.packroff.hellocal.ui.OnbLegalPromise
import dk.packroff.hellocal.ui.OnbLegalSection
import dk.packroff.hellocal.ui.OnbLegalSummary
import dk.packroff.hellocal.ui.OnbRichText
import kotlin.math.roundToInt

/**
 * Shared frame of the legal pages: ScreenHeader + scrolling body (px-4 pt-4 pb-10).
 * [fragment] (web: location.hash): the page opens scrolled to the section with that id.
 */
@Composable
internal fun LegalPage(title: String, fragment: String? = null, content: @Composable ColumnScope.() -> Unit) {
    val nav = LocalNavigator.current
    val scroll = rememberScrollState()
    val density = LocalDensity.current
    var viewportTop by remember { mutableStateOf<Float?>(null) }
    var targetY by remember(fragment) { mutableStateOf<Float?>(null) }
    var targetScroll by remember(fragment) { mutableStateOf(0) }
    var scrolled by remember(fragment) { mutableStateOf(false) }
    val anchor = remember(fragment) {
        OnbLegalAnchor(fragment) { y ->
            if (targetY == null) {
                targetScroll = scroll.value
                targetY = y
            }
        }
    }
    LaunchedEffect(viewportTop, targetY) {
        val top = viewportTop
        val y = targetY
        if (!scrolled && top != null && y != null) {
            scrolled = true
            // The section title lands just under the top of the page (web: scroll-mt), like the page padding.
            val offset = with(density) { 16.dp.toPx() }
            scroll.scrollTo((targetScroll + y - top - offset).roundToInt().coerceAtLeast(0))
        }
    }
    Column(Modifier.fillMaxSize().background(HcColors.Cream)) {
        HcAppBar(title, onBack = { nav.backOrHome() })
        CompositionLocalProvider(LocalOnbLegalAnchor provides anchor) {
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .onGloballyPositioned { coords -> viewportTop = coords.positionInRoot().y }
                    .verticalScroll(scroll)
                    .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 40.dp),
                content = content,
            )
        }
    }
}

@Composable
internal fun LegalP(markup: String) = OnbRichText(markup, HcTypeRoles.Body)

/**
 * Native port of src/app/betingelser/page.tsx (DECISIONS 2026-09-02 and 2026-09-25).
 * Same hard-coded Danish text as the web; /betingelser#pointsystem etc. opens at that section.
 */
@Composable
fun TermsScreen(args: RouteArgs) {
    LegalPage("Betingelser", fragment = args.fragment) {
        HcText("Senest opdateret: 2026-10-02", HcTypeRoles.Caption, color = HcColors.TextSecondary)

        OnbLegalSummary(
            "Kort fortalt",
            listOf(
                "Dine data er dine. Vi bruger dem til at levere Hello Cal til dig, og ikke til annoncer.",
                "Du må gerne sige din mening om os, også offentligt.",
                "Dansk ret og danske forbrugerregler gælder fuldt ud. Vi har ikke skrevet os ud af dem.",
                "Hello Cal er et værktøj, ikke en læge.",
            ),
        )

        OnbLegalSection("1. Parterne og aftalen", id = "parterne") {
            LegalP(
                "Disse betingelser (\"Betingelserne\") udgør aftalen mellem dig (\"Brugeren\") og [[Firmanavn]], CVR-nr. [[CVR-nr.]], " +
                    "[[Adresse]] (\"Hello Cal\", \"vi\"), om brug af appen og hjemmesiden Hello Cal (\"Tjenesten\").",
            )
            LegalP(
                "Ved at oprette en konto eller bruge Tjenesten accepterer du Betingelserne. Vores behandling af personoplysninger er " +
                    "beskrevet i {Privatlivspolitikken|/privatlivspolitik}, som er en selvstændig oplysning og ikke noget, du \"accepterer\" " +
                    "ved at læse den.",
            )
        }

        OnbLegalSection("2. Hvad Hello Cal er og ikke er", id = "hvad-er-hello-cal") {
            LegalP("Tjenesten hjælper dig med at registrere kost, væske, aktivitet, vægt og kropsmål og med at følge din udvikling over tid.")
            LegalP(
                "Hello Cal er ikke en sundhedsfaglig ydelse og stiller hverken diagnoser eller giver behandling. Tal, beregninger, " +
                    "anbefalinger og AI-estimater er vejledende og kan indeholde fejl. De erstatter ikke rådgivning fra læge, diætist " +
                    "eller anden sundhedsperson.",
            )
            LegalP(
                "Er du gravid, ammer, har en spiseforstyrrelse, diabetes eller en anden tilstand, hvor kost og vægt har betydning for " +
                    "dit helbred, bør du tale med din læge, før du bruger Tjenesten til at ændre din kost. Vi garanterer ingen bestemte " +
                    "resultater. Din krop er ikke en regnemaskine, heller ikke selvom appen er.",
            )
        }

        OnbLegalSection("3. Alder", id = "alder") {
            LegalP(
                "Du skal være mindst 13 år for at oprette en konto. Er du under 18 år, anbefaler vi, at du bruger Tjenesten sammen med " +
                    "en forælder eller værge.",
            )
        }

        OnbLegalSection("4. Din konto", id = "konto") {
            LegalP(
                "Kontoen er personlig og må ikke overdrages. Du logger ind med e-mail og adgangskode, Face ID/passkey eller via Google, " +
                    "Apple eller Facebook. Du skal holde dine loginoplysninger fortrolige og give korrekte oplysninger om dig selv.",
            )
            LegalP(
                "Vi sender dig en e-mail, hvis der logges ind på din konto fra en ny enhed eller et nyt land. Får du mistanke om " +
                    "misbrug, skal du skifte adgangskode og kontakte os hurtigst muligt.",
            )
        }

        OnbLegalSection("5. God opførsel", id = "opfoersel") {
            LegalP("Når du bruger Tjenesten, må du ikke:")
            OnbBulletList(
                listOf(
                    "indsende oplysninger, du ved er forkerte, eller billeder, du ikke har ret til at bruge,",
                    "dele andres personoplysninger uden deres samtykke,",
                    "bruge Tjenesten til reklame eller anden kommerciel virksomhed,",
                    "forsøge at skaffe dig adgang til andres konti eller til vores systemer, eller",
                    "automatisk høste (\"scrape\") indhold fra Tjenesten.",
                ),
            )
            LegalP(
                "Du må til gengæld gerne have og give udtryk for meninger, herunder kritik af Hello Cal, hvor du vil. Vi hører det " +
                    "helst selv først, men det er ikke et krav.",
            )
        }

        OnbLegalSection("6. Indhold du bidrager med", id = "indhold") {
            LegalP(
                "Når du opretter en vare, indberetter en fejl, uploader billeder eller deler en opskrift, indestår du for, at " +
                    "oplysningerne efter bedste evne er korrekte, og at du har ret til billederne.",
            )
            LegalP(
                "Du bevarer ophavsretten. Du giver Hello Cal en vederlagsfri, ikke-eksklusiv ret til at bruge, redigere og vise bidrag " +
                    "til den fælles varedatabase i Tjenesten. Bidrag til den fælles database bliver, når de er godkendt, en del af " +
                    "databasen, også hvis du senere sletter din konto. De vises ikke med dit navn.",
            )
            LegalP(
                "Bruger-indsendte varer gennemgås af en administrator, før andre kan se dem. Private data som din dagbog, dine " +
                    "vægtmålinger og dine private opskrifter bliver aldrig en del af den fælles database.",
            )
        }

        OnbLegalSection("7. Forbindelser til andre apps og enheder", id = "integrationer") {
            LegalP(
                "Du kan forbinde Hello Cal med andre apps og enheder, fx Apple Sundhed, Health Connect, Google Health, Fitbit, Garmin, " +
                    "Withings, Polar og Strava. Du vælger selv pr. datatype, hvad der hentes til Hello Cal, og hvad der sendes fra " +
                    "Hello Cal, og du kan ændre valget eller afbryde forbindelsen når som helst under Indstillinger. Når du afbryder, " +
                    "henter og sender vi ikke flere data.",
            )
            LegalP(
                "Data fra andre tjenester kan være forkerte, forsinkede eller mangle, og Hello Cal kan ikke stå inde for dem. Den " +
                    "anden tjeneste har sine egne vilkår og sin egen privatlivspolitik, som gælder for din brug af den.",
            )
        }

        OnbLegalSection("8. Pointsystem", id = "pointsystem") {
            LegalP("Alle nye brugere starter med 35 points, når kontoen oprettes.")
            LegalP("Du kan optjene points på følgende måder:")
            OnbBulletList(
                listOf(
                    "10 points, når en ny vare, du har oprettet (titel, producent, næringsindhold og billede), bliver godkendt.",
                    "+5 points ekstra, hvis varen også har en varedeklaration (indholdsfortegnelse).",
                    "+5 points ekstra, hvis varen har billeder fra flere vinkler.",
                    "20 points, når du udfylder noget, der mangler på en eksisterende vare (indhold, energi, logo eller produktbillede), højst én gang pr. vare.",
                    "10 points, når du scanner en vare igen via banneret “Optjen 10 points” på varesiden, højst én gang pr. vare.",
                    "10 points, når en fejlindberetning, du har sendt, bliver godkendt og rettet.",
                    "5 points, hver gang en ven rent faktisk tilføjer en vare eller en ret, du har videresendt, dog højst 50 points pr. kalendermåned.",
                    "300 points til både dig og din ven, når en ven, du har inviteret, har haft en konto i mindst 3 måneder.",
                    "300 points, hvis du er den første, der tilmelder sig som testperson af en integration, og vi har godkendt, at forbindelsen virker. Der er én testperson pr. integration.",
                ),
            )
            LegalP(
                "300 points kan indløses til én gratis måned af det betalte abonnement, dog højst 12 gratis måneder i alt pr. konto. " +
                    "Points har ingen kontantværdi og kan ikke overdrages.",
            )
            LegalP(
                "Vi kan annullere points, der er optjent ved misbrug, fx gentagne videresendelser mellem de samme to konti eller " +
                    "åbenlyst falske varer og fejlindberetninger.",
            )
        }

        OnbLegalSection("9. Abonnement og betaling", id = "abonnement") {
            LegalP(
                "Tjenesten findes i en gratis udgave og et betalt abonnement. Pris, indhold og betalingsmåde står tydeligt, før du " +
                    "køber. Abonnementet betales forud og fornyes automatisk, indtil du opsiger det. Det gælder også efter en gratis " +
                    "måned via points eller en gavekode.",
            )
            LegalP(
                "Du kan opsige når som helst med virkning fra udgangen af den periode, du har betalt for. Har du købt via App Store " +
                    "eller Google Play, opsiger du dér. Bemærk: Det stopper ikke abonnementet at slette appen.",
            )
            LegalP(
                "Går du ned til den gratis udgave, bliver historik ældre end 3 måneder skjult, men ikke slettet. Den kommer igen, hvis " +
                    "du opgraderer. Vi holder ikke dine data som gidsel.",
            )
        }

        OnbLegalSection("10. Fortrydelsesret", id = "fortrydelsesret") {
            LegalP(
                "Efter forbrugeraftaleloven har du 14 dages fortrydelsesret fra købet. Tager du det betalte abonnement i brug inden " +
                    "for fristen, beder vi dig udtrykkeligt bekræfte det ved købet. Fortryder du alligevel, refunderer vi beløbet med " +
                    "fradrag for den del af perioden, du har brugt, som loven tillader.",
            )
            LegalP("Køb via App Store eller Google Play refunderes efter deres regler og kun af dem.")
        }

        OnbLegalSection("11. Ansvar", id = "ansvar") {
            LegalP(
                "Vi gør vores bedste for, at Tjenesten virker og at data er korrekte, men vi kan ikke love fejlfri drift eller fejlfri " +
                    "næringsdata. Mange varedata kommer fra brugere, producenter og offentlige databaser.",
            )
            LegalP(
                "Hello Cal er ikke ansvarlig for indirekte tab. Vores samlede ansvar for direkte tab er begrænset til det beløb, du har " +
                    "betalt for Tjenesten de seneste 12 måneder. Begrænsningen gælder ikke ved forsæt eller grov uagtsomhed, og den " +
                    "begrænser ikke de rettigheder, du har som forbruger efter ufravigelig lovgivning.",
            )
        }

        OnbLegalSection("12. Ophør", id = "ophoer") {
            LegalP("Du kan til enhver tid lukke din konto via Hjælpecenter. Hvad der sker med dine data, står i Privatlivspolitikken.")
            LegalP(
                "Vi kan lukke en konto ved væsentlig misligholdelse af Betingelserne. Det sker med en skriftlig begrundelse og, hvor " +
                    "det er rimeligt, efter en advarsel. Vi lukker ikke konti \"af enhver grund\".",
            )
        }

        OnbLegalSection("13. Ændringer", id = "aendringer") {
            LegalP(
                "Vi kan ændre Betingelserne. Væsentlige ændringer til ugunst for dig varsler vi mindst 30 dage i forvejen i appen eller " +
                    "pr. e-mail. Har du et betalt abonnement, kan du opsige det inden ændringen træder i kraft.",
            )
        }

        OnbLegalSection("14. Lovvalg og tvister", id = "lovvalg") {
            LegalP(
                "Betingelserne er underlagt dansk ret. Kan vi ikke blive enige, kan du klage til Nævnenes Hus (Forbrugerklagenævnet) " +
                    "eller via EU's klageportal for onlinekøb. Sager ved domstolene anlægges ved din hjemtingret.",
            )
            OnbLegalPromise("Vi har ikke gemt nogen voldgiftsklausuler eller udenlandske domstole i det med småt.")
        }

        OnbLegalSection("15. Kontakt", id = "kontakt") {
            LegalP(
                "[[Firmanavn]], [[Adresse]], e-mail: {support@hellocal.io|mailto:support@hellocal.io}. Du kan også skrive via appens " +
                    "Hjælpecenter.",
            )
        }
    }
}

package dk.packroff.hellocal.screens.onboarding

import androidx.compose.runtime.Composable
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.OnbBulletList
import dk.packroff.hellocal.ui.OnbLegalPromise
import dk.packroff.hellocal.ui.OnbLegalSection
import dk.packroff.hellocal.ui.OnbLegalSummary

/** Native port of src/app/privatlivspolitik/page.tsx (DECISIONS 2026-09-25). Same Danish text as the web. */
@Composable
fun PrivacyScreen(args: RouteArgs) {
    LegalPage("Privatlivspolitik", fragment = args.fragment) {
        HcText("Senest opdateret: 2026-09-27", HcTypeRoles.Caption, color = HcColors.TextSecondary)

        OnbLegalSummary(
            "Kort fortalt",
            listOf(
                "Vi sælger ikke dine data. Ikke til annoncører, ikke til din arbejdsgiver, ikke til nogen.",
                "Ingen annoncesporing: appen indeholder ingen reklamepixels eller sporingsværktøjer fra annoncenetværk.",
                "Vi bygger ikke reklameprofiler på dig, og vi retargeter dig ikke på andre platforme.",
                "Vores support ser kun dine data, hvis du selv giver lov, og kun så længe du giver lov.",
                "Sletter du kontoen, fjerner vi dine personoplysninger. Vi gemmer ikke det hele i ti år for en sikkerheds skyld.",
            ),
        )

        OnbLegalSection("1. Dataansvarlig") {
            LegalP(
                "[[Firmanavn]], CVR-nr. [[CVR-nr.]], [[Adresse]], er dataansvarlig for behandlingen af dine personoplysninger i " +
                    "Hello Cal. Kontakt os om alt, der vedrører dine data, på {support@hellocal.io|mailto:support@hellocal.io} eller " +
                    "via appens Hjælpecenter.",
            )
        }

        OnbLegalSection("2. Hvilke oplysninger vi behandler") {
            OnbBulletList(
                listOf(
                    "**Konto:** e-mail, navn, adgangskode (gemt som envejs-hash, så heller ikke vi kan læse den) og passkeys samt evt. login via Google, Apple eller Facebook (kun navn og e-mail).",
                    "**Profil:** fødselsdato, køn, højde, region og sprog.",
                    "**Helbredsoplysninger:** kost, væske, vægt, kropsmål, aktivitet, søvn, fotodagbog og, hvis du slår det til, menstruationscyklus.",
                    "**Indhold:** egne retter, ingredienser, varer, billeder, fejlindberetninger og supporthenvendelser.",
                    "**Integrationer:** data, du selv vælger at hente fra fx Apple Sundhed, Health Connect, Fitbit eller Withings.",
                    "**Sikkerhed:** enhedstype og land ved login, så vi kan advare dig om login fra en ny enhed eller et nyt land.",
                    "**Abonnement:** abonnementsstatus, points og gavekoder. Kortoplysninger håndteres af betalingsudbyderen, ikke af os.",
                ),
            )
            OnbLegalPromise("Vi indsamler ikke din præcise placering, dine kontakter eller data om din brug af andre apps.")
        }

        OnbLegalSection("3. Formål og retsgrundlag") {
            OnbBulletList(
                listOf(
                    "**At levere Tjenesten** (dagbog, beregninger, statistik, søgning, integrationer, support): aftalen med dig, jf. databeskyttelsesforordningens art. 6, stk. 1, litra b.",
                    "**Helbredsoplysninger:** dit udtrykkelige samtykke, jf. art. 9, stk. 2, litra a. Uden dem kan en kalorietæller ikke tælle. Du kan trække samtykket tilbage, men så kan vi ikke længere levere Tjenesten.",
                    "**Sikkerhed og misbrug** (loginadvarsler, beskyttelse af pointsystemet): vores legitime interesse, jf. art. 6, stk. 1, litra f.",
                    "**Nyhedsbreve, råd og tilbud fra samarbejdspartnere:** kun med dit samtykke, jf. art. 6, stk. 1, litra a. Du kan til og fra under Kommunikation.",
                    "**Bogføring:** retlig forpligtelse, jf. art. 6, stk. 1, litra c, og bogføringsloven.",
                ),
            )
            OnbLegalPromise("Vi bruger aldrig \"legitim interesse\" som bagdør til markedsføring. Markedsføring kræver dit ja.")
        }

        OnbLegalSection("4. AI-genkendelse") {
            LegalP(
                "Når du fotograferer en vare, en varedeklaration eller et måltid, kan billedet sendes til OpenAI for at aflæse varen. " +
                    "Før afsendelse fjerner vi billedets metadata (fx GPS-position, telefonmodel og tidspunkt), og vi sender ingen " +
                    "oplysninger om, hvem du er. Selve billedet kan dog vise noget personligt. Tag derfor billedet tæt på varen.",
            )
            LegalP(
                "Telefonen forsøger først selv at læse varedeklarationen. Kun det, den ikke kan læse sikkert, sendes til OpenAI. For " +
                    "at gætte emballagens sprog bruger vi din region, stregkoden, appens og telefonens sprog og det land, telefonen er " +
                    "i. Landet aflæses af telefonens tidszone, så vi aldrig spørger om eller ser din præcise placering. Kun landet og " +
                    "sprogkoderne sendes med.",
            )
            LegalP("AI bruges ikke til at træffe afgørelser om dig, og vi foretager ikke profilering efter art. 22.")
        }

        OnbLegalSection("5. Hvem vi deler med") {
            LegalP(
                "Vi videregiver ikke dine personoplysninger til samarbejdspartnere, annoncører eller arbejdsgivere. Tilbud fra " +
                    "samarbejdspartnere sender vi selv, og kun hvis du har sagt ja.",
            )
            LegalP(
                "Vi bruger følgende databehandlere, som kun må behandle data efter vores instruks (databehandleraftaler, art. 28):",
            )
            OnbBulletList(
                listOf(
                    "drift og opbevaring på vores egne servere,",
                    "e-mailudbyder til login-, sikkerheds- og servicemails,",
                    "OpenAI til billedgenkendelse (se afsnit 4),",
                    "betalingsudbyder, når betaling er aktiveret.",
                ),
            )
            LegalP(
                "Deler du selv noget, fx en rapport via Hello Doc med din læge eller en ret med en ven, sker det på din foranledning og " +
                    "kun med det indhold, du vælger.",
            )
        }

        OnbLegalSection("6. Overførsel uden for EU") {
            LegalP(
                "Billeder til AI-genkendelse behandles af OpenAI i USA. Overførslen sker på grundlag af EU-U.S. Data Privacy Framework " +
                    "og/eller EU-Kommissionens standardkontraktbestemmelser. Alle andre data behandles inden for EU/EØS.",
            )
        }

        OnbLegalSection("7. Opbevaring og sletning") {
            LegalP(
                "Vi opbevarer dine oplysninger, så længe du har en konto. Beder du om at få kontoen slettet, sletter vi navn, e-mail, " +
                    "adgangskode, kropsdata, søgehistorik og supporthenvendelser og fjerner alle loginmidler. Dagbogsposter, der ikke " +
                    "længere kan knyttes til dig, kan bevares anonymt, så de ikke forstyrrer fælles statistik.",
            )
            LegalP(
                "Regnskabsmateriale opbevares i 5 år efter bogføringsloven. Godkendte bidrag til den fælles varedatabase bliver i " +
                    "databasen uden dit navn.",
            )
        }

        OnbLegalSection("8. Datasporing, cookies og statistik", id = "datasporing") {
            LegalP(
                "Hello Cal bruger kun cookies og lokal lagring, der er nødvendige for, at Tjenesten virker: at holde dig logget ind, " +
                    "genkende din enhed ved sikkerhedsadvarsler og beskytte login mod misbrug. Derfor beder vi dig ikke om at klikke " +
                    "\"accepter alle\". Der er intet at acceptere.",
            )
            OnbLegalPromise(
                "Ingen reklamecookies, ingen sporingspixels, ingen tredjeparts-analyseværktøjer og ingen sporing af dig på tværs af " +
                    "apps og hjemmesider.",
            )
            LegalP(
                "Vi laver samlet statistik om brugen af Hello Cal for at forbedre Tjenesten. Statistikken viser kun grupper, aldrig " +
                    "enkeltpersoner, og vi sælger eller udgiver den ikke som \"trendrapporter\" om, hvad du spiser.",
            )
            LegalP(
                "Besøgsstatistikken (fx hvor mange der åbner hvilke sider) laves med Umami, som kører på vores egen server. Den bruger " +
                    "ingen cookies, gemmer ikke din IP-adresse, sender intet til tredjepart og tæller kun sidevisninger — ikke hvad du " +
                    "registrerer.",
            )
        }

        OnbLegalSection("9. Børn") {
            LegalP(
                "Tjenesten er ikke beregnet til børn under 13 år, og vi indsamler ikke bevidst oplysninger om dem. Bliver vi " +
                    "opmærksomme på en konto tilhørende et barn under 13 år, sletter vi den.",
            )
        }

        OnbLegalSection("10. Dine rettigheder") {
            LegalP("Du har ret til at:")
            OnbBulletList(
                listOf(
                    "få indsigt i og en kopi af de oplysninger, vi har om dig,",
                    "få forkerte oplysninger rettet,",
                    "få dine oplysninger slettet (\"retten til at blive glemt\"),",
                    "få behandlingen begrænset eller gøre indsigelse mod den,",
                    "få dine data udleveret i et almindeligt, maskinlæsbart format (dataportabilitet), og",
                    "trække et samtykke tilbage når som helst, uden at det påvirker lovligheden af behandlingen forud for tilbagetrækningen.",
                ),
            )
            LegalP(
                "Skriv til os via Hjælpecenter eller {support@hellocal.io|mailto:support@hellocal.io}. Vi svarer senest inden for en " +
                    "måned. Du kan altid klage til Datatilsynet, Carl Jacobsens Vej 35, 2500 Valby, www.datatilsynet.dk.",
            )
        }

        OnbLegalSection("11. Ændringer") {
            LegalP(
                "Ændrer vi, hvordan vi behandler dine data, opdaterer vi denne side. Væsentlige ændringer får du besked om i appen, " +
                    "før de træder i kraft. Se også vores {Betingelser|/betingelser}.",
            )
        }
    }
}

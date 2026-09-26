"use client";

import Link from "next/link";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { LegalPromise, LegalSection as Section, LegalSummary, Placeholder } from "@/components/hf/LegalDocument";

// Privatlivspolitik (docs/DECISIONS.md 2026-09-25). Beskriver den faktiske
// behandling: data ligger på serveren igen efter "Restore normal user login".
// Må kun love det, koden rent faktisk gør — opdatér ved ny databehandling.
export default function PrivatlivspolitikPage() {
  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <ScreenHeader title="Privatlivspolitik" />

      <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4">
        <p className="hf-type-caption opacity-70">Senest opdateret: 2026-09-25</p>

        <LegalSummary
          title="Kort fortalt"
          items={[
            "Vi sælger ikke dine data. Ikke til annoncører, ikke til din arbejdsgiver, ikke til nogen.",
            "Ingen annoncesporing: appen indeholder ingen reklamepixels eller sporingsværktøjer fra annoncenetværk.",
            "Vi bygger ikke reklameprofiler på dig, og vi retargeter dig ikke på andre platforme.",
            "Vores support ser kun dine data, hvis du selv giver lov, og kun så længe du giver lov.",
            "Sletter du kontoen, fjerner vi dine personoplysninger. Vi gemmer ikke det hele i ti år for en sikkerheds skyld.",
          ]}
        />

        <Section title="1. Dataansvarlig">
          <p>
            <Placeholder>Firmanavn</Placeholder>, CVR-nr. <Placeholder>CVR-nr.</Placeholder>,{" "}
            <Placeholder>Adresse</Placeholder>, er dataansvarlig for behandlingen af dine
            personoplysninger i Hello Cal. Kontakt os om alt, der vedrører dine data, på{" "}
            <Placeholder>kontakt-e-mail</Placeholder> eller via appens Hjælpecenter.
          </p>
        </Section>

        <Section title="2. Hvilke oplysninger vi behandler">
          <ul className="list-disc pl-5">
            <li><b>Konto:</b> e-mail, navn, adgangskode (gemt som envejs-hash, så heller ikke vi kan læse den) og passkeys samt evt. login via Google, Apple eller Facebook (kun navn og e-mail).</li>
            <li><b>Profil:</b> fødselsdato, køn, højde, region og sprog.</li>
            <li><b>Helbredsoplysninger:</b> kost, væske, vægt, kropsmål, aktivitet, søvn, fotodagbog og, hvis du slår det til, menstruationscyklus.</li>
            <li><b>Indhold:</b> egne retter, ingredienser, produkter, billeder, fejlindberetninger og supporthenvendelser.</li>
            <li><b>Integrationer:</b> data, du selv vælger at hente fra fx Apple Sundhed, Health Connect, Fitbit eller Withings.</li>
            <li><b>Sikkerhed:</b> enhedstype og land ved login, så vi kan advare dig om login fra en ny enhed eller et nyt land.</li>
            <li><b>Abonnement:</b> abonnementsstatus, points og gavekoder. Kortoplysninger håndteres af betalingsudbyderen, ikke af os.</li>
          </ul>
          <LegalPromise>Vi indsamler ikke din præcise placering, dine kontakter eller data om din brug af andre apps.</LegalPromise>
        </Section>

        <Section title="3. Formål og retsgrundlag">
          <ul className="list-disc pl-5">
            <li><b>At levere Tjenesten</b> (dagbog, beregninger, statistik, søgning, integrationer, support): aftalen med dig, jf. databeskyttelsesforordningens art. 6, stk. 1, litra b.</li>
            <li><b>Helbredsoplysninger:</b> dit udtrykkelige samtykke, jf. art. 9, stk. 2, litra a. Uden dem kan en kalorietæller ikke tælle. Du kan trække samtykket tilbage, men så kan vi ikke længere levere Tjenesten.</li>
            <li><b>Sikkerhed og misbrug</b> (loginadvarsler, beskyttelse af pointsystemet): vores legitime interesse, jf. art. 6, stk. 1, litra f.</li>
            <li><b>Nyhedsbreve, råd og tilbud fra samarbejdspartnere:</b> kun med dit samtykke, jf. art. 6, stk. 1, litra a. Du kan til og fra under Kommunikation.</li>
            <li><b>Bogføring:</b> retlig forpligtelse, jf. art. 6, stk. 1, litra c, og bogføringsloven.</li>
          </ul>
          <LegalPromise>Vi bruger aldrig &quot;legitim interesse&quot; som bagdør til markedsføring. Markedsføring kræver dit ja.</LegalPromise>
        </Section>

        <Section title="4. AI-genkendelse">
          <p>
            Når du fotograferer en vare, en varedeklaration eller et måltid, kan billedet sendes til
            OpenAI for at aflæse produktet. Før afsendelse fjerner vi billedets metadata (fx
            GPS-position, telefonmodel og tidspunkt), og vi sender ingen oplysninger om, hvem du er.
            Selve billedet kan dog vise noget personligt. Tag derfor billedet tæt på produktet.
          </p>
          <p>AI bruges ikke til at træffe afgørelser om dig, og vi foretager ikke profilering efter art. 22.</p>
        </Section>

        <Section title="5. Hvem vi deler med">
          <p>
            Vi videregiver ikke dine personoplysninger til samarbejdspartnere, annoncører eller
            arbejdsgivere. Tilbud fra samarbejdspartnere sender vi selv, og kun hvis du har sagt ja.
          </p>
          <p>Vi bruger følgende databehandlere, som kun må behandle data efter vores instruks (databehandleraftaler, art. 28):</p>
          <ul className="list-disc pl-5">
            <li>drift og opbevaring på vores egne servere,</li>
            <li>e-mailudbyder til login-, sikkerheds- og servicemails,</li>
            <li>OpenAI til billedgenkendelse (se afsnit 4),</li>
            <li>betalingsudbyder, når betaling er aktiveret.</li>
          </ul>
          <p>
            Deler du selv noget, fx en rapport via Hello Doc med din læge eller en ret med en ven,
            sker det på din foranledning og kun med det indhold, du vælger.
          </p>
        </Section>

        <Section title="6. Overførsel uden for EU">
          <p>
            Billeder til AI-genkendelse behandles af OpenAI i USA. Overførslen sker på grundlag af
            EU-U.S. Data Privacy Framework og/eller EU-Kommissionens standardkontraktbestemmelser.
            Alle andre data behandles inden for EU/EØS.
          </p>
        </Section>

        <Section title="7. Opbevaring og sletning">
          <p>
            Vi opbevarer dine oplysninger, så længe du har en konto. Beder du om at få kontoen
            slettet, sletter vi navn, e-mail, adgangskode, kropsdata, søgehistorik og
            supporthenvendelser og fjerner alle loginmidler. Dagbogsposter, der ikke længere kan
            knyttes til dig, kan bevares anonymt, så de ikke forstyrrer fælles statistik.
          </p>
          <p>
            Regnskabsmateriale opbevares i 5 år efter bogføringsloven. Godkendte bidrag til den fælles
            produktdatabase bliver i databasen uden dit navn.
          </p>
        </Section>

        <Section id="datasporing" title="8. Datasporing, cookies og statistik">
          <p>
            Hello Cal bruger kun cookies og lokal lagring, der er nødvendige for, at Tjenesten virker:
            at holde dig logget ind, genkende din enhed ved sikkerhedsadvarsler og beskytte login mod
            misbrug. Derfor beder vi dig ikke om at klikke &quot;accepter alle&quot;. Der er intet at
            acceptere.
          </p>
          <LegalPromise>
            Ingen reklamecookies, ingen sporingspixels, ingen tredjeparts-analyseværktøjer og ingen
            sporing af dig på tværs af apps og hjemmesider.
          </LegalPromise>
          <p>
            Vi laver samlet statistik om brugen af Hello Cal for at forbedre Tjenesten. Statistikken
            viser kun grupper, aldrig enkeltpersoner, og vi sælger eller udgiver den ikke som
            &quot;trendrapporter&quot; om, hvad du spiser.
          </p>
        </Section>

        <Section title="9. Børn">
          <p>
            Tjenesten er ikke beregnet til børn under 13 år, og vi indsamler ikke bevidst oplysninger
            om dem. Bliver vi opmærksomme på en konto tilhørende et barn under 13 år, sletter vi den.
          </p>
        </Section>

        <Section title="10. Dine rettigheder">
          <p>Du har ret til at:</p>
          <ul className="list-disc pl-5">
            <li>få indsigt i og en kopi af de oplysninger, vi har om dig,</li>
            <li>få forkerte oplysninger rettet,</li>
            <li>få dine oplysninger slettet (&quot;retten til at blive glemt&quot;),</li>
            <li>få behandlingen begrænset eller gøre indsigelse mod den,</li>
            <li>få dine data udleveret i et almindeligt, maskinlæsbart format (dataportabilitet), og</li>
            <li>trække et samtykke tilbage når som helst, uden at det påvirker lovligheden af behandlingen forud for tilbagetrækningen.</li>
          </ul>
          <p>
            Skriv til os via Hjælpecenter eller <Placeholder>kontakt-e-mail</Placeholder>. Vi svarer
            senest inden for en måned. Du kan altid klage til Datatilsynet, Carl Jacobsens Vej 35, 2500
            Valby, www.datatilsynet.dk.
          </p>
        </Section>

        <Section title="11. Ændringer">
          <p>
            Ændrer vi, hvordan vi behandler dine data, opdaterer vi denne side. Væsentlige ændringer
            får du besked om i appen, før de træder i kraft. Se også vores{" "}
            <Link href="/betingelser" className="underline">
              Betingelser
            </Link>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { LegalPromise, LegalSection as Section, LegalSummary, Placeholder } from "@/components/hf/LegalDocument";

// Betingelser (docs/DECISIONS.md 2026-09-02 og 2026-09-25): egne vilkår for en
// kalorietæller-app. Struktur inspireret af branchens standardvilkår, men
// bevidst mere forbrugervenlige. #pointsystem-ankeret linkes til fra bannere
// ved produkt-/fejlindberetnings-points.
export default function BetingelserPage() {
  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <ScreenHeader title="Betingelser" />

      <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4">
        <p className="text-text-secondary hf-type-caption">Senest opdateret: 2026-09-25</p>

        <LegalSummary
          title="Kort fortalt"
          items={[
            "Dine data er dine. Vi bruger dem til at levere Hello Cal til dig, og ikke til annoncer.",
            "Du må gerne sige din mening om os, også offentligt.",
            "Dansk ret og danske forbrugerregler gælder fuldt ud. Vi har ikke skrevet os ud af dem.",
            "Hello Cal er et værktøj, ikke en læge.",
          ]}
        />

        <Section title="1. Parterne og aftalen">
          <p>
            Disse betingelser (&quot;Betingelserne&quot;) udgør aftalen mellem dig (&quot;Brugeren&quot;)
            og <Placeholder>Firmanavn</Placeholder>, CVR-nr. <Placeholder>CVR-nr.</Placeholder>,{" "}
            <Placeholder>Adresse</Placeholder> (&quot;Hello Cal&quot;, &quot;vi&quot;), om brug af
            appen og hjemmesiden Hello Cal (&quot;Tjenesten&quot;).
          </p>
          <p>
            Ved at oprette en konto eller bruge Tjenesten accepterer du Betingelserne. Vores behandling
            af personoplysninger er beskrevet i{" "}
            <Link href="/privatlivspolitik" className="underline">
              Privatlivspolitikken
            </Link>
            , som er en selvstændig oplysning og ikke noget, du &quot;accepterer&quot; ved at læse
            den.
          </p>
        </Section>

        <Section title="2. Hvad Hello Cal er og ikke er">
          <p>
            Tjenesten hjælper dig med at registrere kost, væske, aktivitet, vægt og kropsmål og med at
            følge din udvikling over tid.
          </p>
          <p>
            Hello Cal er ikke en sundhedsfaglig ydelse og stiller hverken diagnoser eller giver
            behandling. Tal, beregninger, anbefalinger og AI-estimater er vejledende og kan indeholde
            fejl. De erstatter ikke rådgivning fra læge, diætist eller anden sundhedsperson.
          </p>
          <p>
            Er du gravid, ammer, har en spiseforstyrrelse, diabetes eller en anden tilstand, hvor kost
            og vægt har betydning for dit helbred, bør du tale med din læge, før du bruger Tjenesten
            til at ændre din kost. Vi garanterer ingen bestemte resultater. Din krop er ikke en
            regnemaskine, heller ikke selvom appen er.
          </p>
        </Section>

        <Section title="3. Alder">
          <p>
            Du skal være mindst 13 år for at oprette en konto. Er du under 18 år, anbefaler vi, at du
            bruger Tjenesten sammen med en forælder eller værge.
          </p>
        </Section>

        <Section title="4. Din konto">
          <p>
            Kontoen er personlig og må ikke overdrages. Du logger ind med e-mail og adgangskode, Face
            ID/passkey eller via Google, Apple eller Facebook. Du skal holde dine loginoplysninger
            fortrolige og give korrekte oplysninger om dig selv.
          </p>
          <p>
            Vi sender dig en e-mail, hvis der logges ind på din konto fra en ny enhed eller et nyt
            land. Får du mistanke om misbrug, skal du skifte adgangskode og kontakte os hurtigst
            muligt.
          </p>
        </Section>

        <Section title="5. God opførsel">
          <p>Når du bruger Tjenesten, må du ikke:</p>
          <ul className="list-disc pl-5">
            <li>indsende oplysninger, du ved er forkerte, eller billeder, du ikke har ret til at bruge,</li>
            <li>dele andres personoplysninger uden deres samtykke,</li>
            <li>bruge Tjenesten til reklame eller anden kommerciel virksomhed,</li>
            <li>forsøge at skaffe dig adgang til andres konti eller til vores systemer, eller</li>
            <li>automatisk høste (&quot;scrape&quot;) indhold fra Tjenesten.</li>
          </ul>
          <p>
            Du må til gengæld gerne have og give udtryk for meninger, herunder kritik af Hello Cal,
            hvor du vil. Vi hører det helst selv først, men det er ikke et krav.
          </p>
        </Section>

        <Section title="6. Indhold du bidrager med">
          <p>
            Når du opretter et produkt, indberetter en fejl, uploader billeder eller deler en opskrift,
            indestår du for, at oplysningerne efter bedste evne er korrekte, og at du har ret til
            billederne.
          </p>
          <p>
            Du bevarer ophavsretten. Du giver Hello Cal en vederlagsfri, ikke-eksklusiv ret til at
            bruge, redigere og vise bidrag til den fælles produktdatabase i Tjenesten. Bidrag til den
            fælles database bliver, når de er godkendt, en del af databasen, også hvis du senere
            sletter din konto. De vises ikke med dit navn.
          </p>
          <p>
            Bruger-indsendte produkter gennemgås af en administrator, før andre kan se dem. Private
            data som din dagbog, dine vægtmålinger og dine private opskrifter bliver aldrig en del af
            den fælles database.
          </p>
        </Section>

        <Section id="pointsystem" title="7. Pointsystem">
          <p>Du kan optjene points på følgende måder:</p>
          <ul className="list-disc pl-5">
            <li>10 points, når et nyt produkt, du har oprettet (titel, producent, næringsindhold og billede), bliver godkendt.</li>
            <li>+5 points ekstra, hvis produktet også har en varedeklaration (indholdsfortegnelse).</li>
            <li>+5 points ekstra, hvis produktet har billeder fra flere vinkler.</li>
            <li>10 points, når en fejlindberetning, du har sendt, bliver godkendt og rettet.</li>
            <li>5 points, hver gang en ven rent faktisk tilføjer et produkt eller en ret, du har videresendt, dog højst 50 points pr. kalendermåned.</li>
            <li>300 points til både dig og din ven, når en ven, du har inviteret, har haft en konto i mindst 3 måneder.</li>
          </ul>
          <p>
            300 points kan indløses til én gratis måned af det betalte abonnement, dog højst 12
            gratis måneder i alt pr. konto. Points har ingen kontantværdi og kan ikke overdrages.
          </p>
          <p>
            Vi kan annullere points, der er optjent ved misbrug, fx gentagne videresendelser mellem de
            samme to konti eller åbenlyst falske produkter og fejlindberetninger.
          </p>
        </Section>

        <Section title="8. Abonnement og betaling">
          <p>
            Tjenesten findes i en gratis udgave og et betalt abonnement. Pris, indhold og
            betalingsmåde står tydeligt, før du køber. Abonnementet betales forud og fornyes
            automatisk, indtil du opsiger det. Det gælder også efter en gratis måned via points eller
            en gavekode.
          </p>
          <p>
            Du kan opsige når som helst med virkning fra udgangen af den periode, du har betalt for.
            Har du købt via App Store eller Google Play, opsiger du dér. Bemærk: Det stopper ikke
            abonnementet at slette appen.
          </p>
          <p>
            Går du ned til den gratis udgave, bliver historik ældre end 30 dage skjult, men ikke
            slettet. Den kommer igen, hvis du opgraderer. Vi holder ikke dine data som gidsel.
          </p>
        </Section>

        <Section title="9. Fortrydelsesret">
          <p>
            Efter forbrugeraftaleloven har du 14 dages fortrydelsesret fra købet. Tager du det
            betalte abonnement i brug inden for fristen, beder vi dig udtrykkeligt bekræfte det ved
            købet. Fortryder du alligevel, refunderer vi beløbet med fradrag for den del af perioden,
            du har brugt, som loven tillader.
          </p>
          <p>
            Køb via App Store eller Google Play refunderes efter deres regler og kun af dem.
          </p>
        </Section>

        <Section title="10. Ansvar">
          <p>
            Vi gør vores bedste for, at Tjenesten virker og at data er korrekte, men vi kan ikke love
            fejlfri drift eller fejlfri næringsdata. Mange produktdata kommer fra brugere, producenter
            og offentlige databaser.
          </p>
          <p>
            Hello Cal er ikke ansvarlig for indirekte tab. Vores samlede ansvar for direkte tab er
            begrænset til det beløb, du har betalt for Tjenesten de seneste 12 måneder. Begrænsningen
            gælder ikke ved forsæt eller grov uagtsomhed, og den begrænser ikke de rettigheder, du har
            som forbruger efter ufravigelig lovgivning.
          </p>
        </Section>

        <Section title="11. Ophør">
          <p>
            Du kan til enhver tid lukke din konto via Hjælpecenter. Hvad der sker med dine data, står
            i Privatlivspolitikken.
          </p>
          <p>
            Vi kan lukke en konto ved væsentlig misligholdelse af Betingelserne. Det sker med en
            skriftlig begrundelse og, hvor det er rimeligt, efter en advarsel. Vi lukker ikke konti
            &quot;af enhver grund&quot;.
          </p>
        </Section>

        <Section title="12. Ændringer">
          <p>
            Vi kan ændre Betingelserne. Væsentlige ændringer til ugunst for dig varsler vi mindst 30
            dage i forvejen i appen eller pr. e-mail. Har du et betalt abonnement, kan du opsige det
            inden ændringen træder i kraft.
          </p>
        </Section>

        <Section title="13. Lovvalg og tvister">
          <p>
            Betingelserne er underlagt dansk ret. Kan vi ikke blive enige, kan du klage til
            Nævnenes Hus (Forbrugerklagenævnet) eller via EU&apos;s klageportal for onlinekøb. Sager ved
            domstolene anlægges ved din hjemtingret.
          </p>
          <LegalPromise>Vi har ikke gemt nogen voldgiftsklausuler eller udenlandske domstole i det med småt.</LegalPromise>
        </Section>

        <Section title="14. Kontakt">
          <p>
            <Placeholder>Firmanavn</Placeholder>, <Placeholder>Adresse</Placeholder>, e-mail:{" "}
            <Placeholder>kontakt-e-mail</Placeholder>. Du kan også skrive via appens Hjælpecenter.
          </p>
        </Section>
      </div>
    </div>
  );
}

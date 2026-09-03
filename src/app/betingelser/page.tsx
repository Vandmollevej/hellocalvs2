"use client";

import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/hf/ScreenHeader";

// Betingelser (docs/DECISIONS.md 2026-09-02): egne standardbetingelser
// skrevet til en kalorietæller-app i HelloFresh-inspireret stil (design.md),
// IKKE en kopi af HelloFreshs juridiske tekst. #pointsystem-ankeret linkes
// til fra bannere ved produkt-/fejlindberetnings-points.
function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-6 scroll-mt-20">
      <h2 className="hf-type-section-title">{title}</h2>
      <div className="hf-type-body-sm mt-2 flex flex-col gap-2 opacity-90">{children}</div>
    </section>
  );
}

export default function BetingelserPage() {
  const router = useRouter();

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <ScreenHeader title="Betingelser" onBack={() => router.back()} />

      <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4">
        <p className="hf-type-caption opacity-70">Senest opdateret: 2026-09-03</p>

        <Section title="1. Om Hello Cal">
          <p>
            Hello Cal er en app til at registrere kost, aktivitet og vægt. Ved at oprette en konto
            accepterer du disse betingelser.
          </p>
        </Section>

        <Section title="2. Din konto">
          <p>
            Du er ansvarlig for at holde din adgangskode fortrolig og for aktivitet på din konto. Du
            skal give korrekte oplysninger ved oprettelse.
          </p>
        </Section>

        <Section title="3. Indhold du bidrager med">
          <p>
            Når du opretter et produkt, tilføjer en varedeklaration eller uploader billeder, indestår
            du for at oplysningerne er korrekte efter bedste evne. Alle bruger-indsendte produkter
            gennemgås af en administrator, før de bliver synlige for andre brugere.
          </p>
        </Section>

        <Section id="pointsystem" title="4. Pointsystem">
          <p>Du kan optjene points på følgende måder:</p>
          <ul className="list-disc pl-5">
            <li>10 points, når et nyt produkt du har oprettet (titel, producent, næringsindhold og billede) bliver godkendt.</li>
            <li>+5 points ekstra, hvis produktet også har en varedeklaration (indholdsfortegnelse).</li>
            <li>+5 points ekstra, hvis produktet har billeder fra flere vinkler.</li>
            <li>10 points, når en fejlindberetning du har sendt bliver godkendt og rettet.</li>
            <li>5 points, hver gang en ven rent faktisk tilføjer et produkt eller en ret, du har videresendt til dem — op til 50 points pr. kalendermåned.</li>
            <li>300 points til både dig og din ven, når en ven du har inviteret opretter en konto og har været registreret i mindst 3 måneder.</li>
          </ul>
          <p>
            300 points kan indløses til 1 gratis abonnementsmåned. Indløsning kræver en gemt
            betalingsmetode, så abonnementet fortsætter automatisk til fuld pris, når den gratis
            måned er brugt. Der er et loft på 12 gratis måneder i alt pr. konto.
          </p>
          <p>
            Hello Cal forbeholder sig retten til at annullere points optjent ved misbrug, herunder
            gentagne videresendelser mellem de samme to konti (&quot;frem og tilbage&quot;) eller
            gennemskueligt falske produkt-/fejlindberetninger.
          </p>
        </Section>

        <Section title="5. Betaling og abonnement">
          <p>
            Hvor Hello Cal tilbyder et betalt abonnement, fremgår prisen og betalingsmetoderne
            tydeligt, før du bekræfter et køb. Et abonnement fortsætter automatisk, medmindre du
            opsiger det, herunder efter en gratis måned optjent via pointsystemet.
          </p>
        </Section>

        <Section title="6. Ansvarsfraskrivelse">
          <p>
            Hello Cal er et hjælpeværktøj til at følge dit kalorie- og næringsindtag. Oplysningerne i
            appen — herunder bruger-indsendte produkter og AI-estimater — kan indeholde fejl og
            erstatter ikke professionel ernærings- eller sundhedsrådgivning.
          </p>
        </Section>

        <Section title="7. Ret til at blive glemt">
          <p>
            Du kan til enhver tid bede om at få din konto slettet. Dine personlige oplysninger
            anonymiseres; historiske registreringer bevares i anonymiseret form, så statistik for
            andre brugere ikke påvirkes.
          </p>
        </Section>

        <Section title="8. Kontakt">
          <p>Spørgsmål til disse betingelser kan sendes til support via appens hjælpecenter.</p>
        </Section>
      </div>
    </div>
  );
}

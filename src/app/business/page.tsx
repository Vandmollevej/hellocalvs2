import type { Metadata } from "next";
import Link from "next/link";
import { IconAd2, IconChartBar, IconChefHat, IconPackage, IconStethoscope } from "@tabler/icons-react";
import { MarketingShell, SectionHeading } from "@/components/landing/MarketingShell";
import { BusinessContactForm } from "@/components/landing/BusinessContactForm";
import { BusinessAudience } from "@/components/landing/BusinessAudience";
import { loadBusinessAudience } from "@/lib/business-audience-data";
import { isBusinessTopic } from "@/lib/business-contact-topics";

export const metadata: Metadata = { title: "Business — Hello Cal", robots: { index: false, follow: false } };

// Business-partnere (footeren på forsiden): hvad Hello Cal kan tilbyde
// virksomheder + den eneste kontaktformular på de offentlige sider.

const OPPORTUNITIES = [
  {
    icon: IconAd2,
    title: "Annoncering i appen",
    text: "Faste placeringer i appen, målrettet brugere der aktivt arbejder med kost og sundhed. Familieprofiler ser aldrig reklamer.",
  },
  {
    icon: IconChartBar,
    title: "Rapporter og indsigt",
    text: "Løbende rapporter om visninger og klik på jeres placeringer — sendt automatisk til jeres kontaktpersoner.",
  },
  {
    icon: IconPackage,
    title: "Produktdata",
    text: "Producenter og kæder kan levere korrekte næringsdata og billeder, så jeres varer vises rigtigt, når de scannes.",
  },
  {
    icon: IconChefHat,
    title: "Opskrifter og måltider",
    text: "Få jeres retter og måltidskasser ind i appen med færdigt beregnet næringsindhold pr. portion.",
  },
  {
    icon: IconStethoscope,
    title: "Sundhedsfaglige samarbejder",
    text: "Læger, diætister og klinikker kan følge klienters fremgang via Hello Doc — med klientens samtykke.",
  },
];

export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ emne?: string }> }) {
  const { emne } = await searchParams;
  const initialTopic = emne && isBusinessTopic(emne) ? emne : undefined;
  const audience = await loadBusinessAudience();

  return (
    <MarketingShell>
      <section
        className="px-4 py-20 text-hf-white sm:px-6"
        style={{ background: "linear-gradient(135deg, #0a8f53 0%, #067A46 45%, #035624 100%)" }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-hf-green-light">Business</p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Samarbejd med Hello Cal</h1>
          <p className="mt-6 text-lg leading-relaxed text-hf-white/85">
            Nå danskere, der hver dag træffer bevidste valg om mad og sundhed — på en måde, der respekterer deres data.
          </p>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <SectionHeading title="Mulighederne i" accent="Hello Cal" />
        <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {OPPORTUNITIES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-hf-cream p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-hf-green text-hf-white">
                <Icon size={24} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-hf-black">{title}</h2>
              <p className="mt-2 leading-relaxed text-text-secondary">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <BusinessAudience profile={audience} />

      <section id="kontakt" className="scroll-mt-20 bg-hf-tan px-4 py-20 sm:px-6">
        <SectionHeading title="Kontakt" accent="os" text="Fortæl kort om jer og jeres idé, så vender vi tilbage." />
        <div className="mx-auto mt-10 max-w-3xl">
          <BusinessContactForm initialTopic={initialTopic} />
          <p className="mt-6 text-center text-sm text-text-secondary">
            Har I allerede en aftale med Hello Cal?{" "}
            <Link href="/partner/login" className="font-semibold text-hf-green-dark underline">
              Log ind på partnerportalen
            </Link>
            . Adgangen oprettes af Hello Cal — der er ingen selvbetjent tilmelding.
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}

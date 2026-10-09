import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { IconDownload } from "@tabler/icons-react";
import { MarketingShell, SectionHeading } from "@/components/landing/MarketingShell";
import { SUBSCRIPTION_PRICES_DKK } from "@/lib/subscription-plans";

export const metadata: Metadata = { title: "Presse — Hello Cal", robots: { index: false, follow: false } };

// Presse (footeren på forsiden): fakta og logoer. Henvendelser går via
// business-formularen med emnet "Presse" — ingen egen kontaktformular.

const FACTS = [
  ["Hvad", "Dansk app til kalorie- og måltidsregistrering"],
  ["Platforme", "iPhone (App Store) og Android (Google Play)"],
  ["Pris", `Gratis · Seriøs ${SUBSCRIPTION_PRICES_DKK.serious[1]} kr./md. · Seriøs Familie ${SUBSCRIPTION_PRICES_DKK.family[1]} kr./md.`],
  ["Data", "Brugernes data bruges kun til at levere appen — aldrig til annoncer"],
] as const;

const LOGOS = [
  { src: "/hello-cal-logo.png", label: "Logo — grøn", bg: "bg-hf-white" },
  { src: "/hello-cal-logo-white.png", label: "Logo — hvid", bg: "bg-hf-green" },
];

export default function PressPage() {
  return (
    <MarketingShell>
      <section
        className="px-4 py-20 text-hf-white sm:px-6 mk-hero-bg"
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="mk-eyebrow">Presse</p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Hello Cal til pressen</h1>
          <p className="mt-6 text-lg leading-relaxed text-hf-white/85">Fakta, logoer og kontakt til dig, der skriver om Hello Cal.</p>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <SectionHeading title="Fakta om" accent="Hello Cal" />
        <dl className="mx-auto mt-10 grid max-w-3xl gap-4">
          {FACTS.map(([k, v]) => (
            <div key={k} className="grid gap-1 rounded-2xl bg-hf-cream p-5 sm:grid-cols-[140px_1fr]">
              <dt className="font-bold text-hf-black">{k}</dt>
              <dd className="text-text-secondary">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-hf-tan px-4 py-20 sm:px-6">
        <SectionHeading title="Logoer" text="Må bruges i omtale af Hello Cal. Undlad at ændre farver eller proportioner." />
        <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
          {LOGOS.map((logo) => (
            <div key={logo.src} className="overflow-hidden rounded-2xl bg-hf-white shadow-sm">
              <div className={`flex h-40 items-center justify-center ${logo.bg}`}>
                <Image src={logo.src} alt="" width={200} height={66} className="h-auto w-44" />
              </div>
              <a
                href={logo.src}
                download
                className="flex items-center justify-center gap-2 p-4 text-sm font-semibold text-hf-green hover:underline"
              >
                <IconDownload size={18} aria-hidden="true" /> {logo.label} (PNG)
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20 text-center sm:px-6">
        <SectionHeading title="Pressekontakt" text="Skriv til os via kontaktformularen — vælg emnet Presse." />
        <Link
          href="/business?emne=press#kontakt"
          className="mt-8 mk-btn mk-btn--brand"
        >
          Kontakt os
        </Link>
      </section>
    </MarketingShell>
  );
}

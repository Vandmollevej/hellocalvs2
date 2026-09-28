import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { additiveAnchorId } from "@/lib/additive-anchor";

export const metadata: Metadata = { title: "E-numre · Hello Cal" };
export const dynamic = "force-dynamic";

// Samlet E-nummer-side (opgave 32): hele "additives"-tabellen, ét afsnit pr.
// E-nummer med eget anchor (/e-numre#e100), så info-vinduet og andre sider kan
// linke direkte til det enkelte nummer.
export default async function AdditivesPage() {
  const additives = await prisma.additive.findMany();
  additives.sort((a, b) =>
    a.eNumber.localeCompare(b.eNumber, "da", { numeric: true }),
  );

  return (
    <div className="fixed inset-0 overflow-y-auto scroll-smooth bg-white px-4 py-10 text-neutral-900">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-sm text-[#067a46] hover:underline">← Forside</Link>
        <h1 className="mt-6 text-3xl font-semibold">E-numre</h1>
        <p className="mt-4 text-neutral-600">
          Oversigt over {additives.length} EU-godkendte tilsætningsstoffer. Generel
          baggrundsinformation baseret på EFSA/EU-kilder — ikke personlig kostrådgivning.
        </p>

        <nav aria-label="E-numre" className="mt-6 flex flex-wrap gap-1.5">
          {additives.map((a) => (
            <a
              key={a.eNumber}
              href={`#${additiveAnchorId(a.eNumber)}`}
              className="rounded-full border border-neutral-200 px-2 py-0.5 text-xs text-[#067a46] hover:bg-neutral-50"
            >
              {a.eNumber}
            </a>
          ))}
        </nav>

        <div className="mt-8 flex flex-col divide-y divide-neutral-200">
          {additives.map((a) => (
            <section
              key={a.eNumber}
              id={additiveAnchorId(a.eNumber)}
              className="scroll-mt-4 py-6 target:bg-[#067a46]/5"
            >
              <h2 className="text-xl font-semibold">
                <a href={`#${additiveAnchorId(a.eNumber)}`} className="hover:underline">
                  {a.eNumber}
                </a>
                {a.internationalName ? ` · ${a.internationalName}` : ""}
              </h2>
              {a.danishName && <p className="mt-1 text-sm text-neutral-500">{a.danishName}</p>}
              {a.function && <p className="mt-3 text-neutral-700">{a.function}</p>}
              {a.risks && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase text-neutral-500">Risici</p>
                  <p className="text-neutral-700">{a.risks}</p>
                </div>
              )}
              {a.research && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase text-neutral-500">Forskning</p>
                  <p className="text-neutral-700">{a.research}</p>
                </div>
              )}
              {a.link && (
                <a
                  href={a.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm text-[#067a46] underline underline-offset-2"
                >
                  Læs mere ({a.source || "kilde"})
                </a>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

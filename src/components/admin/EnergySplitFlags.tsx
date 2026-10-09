import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DEVIATION_POINTS, type EnergySplit } from "@/lib/energy-split-check";
import { ReviewEnergySplitButton } from "@/components/admin/ReviewEnergySplitButton";

const fmt = (s: EnergySplit) => `P ${Math.round(s.protein)} % · K ${Math.round(s.carbs)} % · F ${Math.round(s.fat)} %`;

// Natlig robot "energy-split-check" (docs/DECISIONS.md 2026-10-07): varer,
// hvis energifordeling afviger fra identiske varer, der kun adskiller sig på
// mængde. Varerne er stadig aktive — admin undersøger dem.
export async function EnergySplitFlags() {
  const flags = await prisma.productEnergySplitFlag.findMany({
    where: { reviewedAt: null },
    orderBy: { deviationPoints: "desc" },
    take: 500,
    include: { product: { select: { id: true, name: true, packageSizeText: true, brand: { select: { name: true } } } } },
  });

  return (
    <section className="flex flex-col gap-4">
      <h2 className="hf-type-body hf-type-strong uppercase tracking-wide text-text-muted">
        Energi-afvigelser ({flags.length})
      </h2>
      <p className="hf-type-body text-text-secondary">
        Varer med samme brand, produkttype og variant, men anden energifordeling (afvigelse over {DEVIATION_POINTS}{" "}
        procentpoint) end de øvrige størrelser. Varerne er stadig aktive; tjek tallene mod emballagen.
      </p>
      {flags.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen afvigelser fundet.</p>
      ) : (
        flags.map((flag) => (
          <div key={flag.id} className="hf-panel">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/admin/products/${flag.product.id}`} className="hf-type-body hf-type-strong text-hf-black">
                {flag.product.brand?.name ? `${flag.product.brand.name} ` : ""}
                {flag.product.name}
                {flag.product.packageSizeText ? ` (${flag.product.packageSizeText})` : ""}
              </Link>
              <span className="hf-type-small shrink-0 rounded-full bg-hf-tan px-2 py-0.5 text-hf-black">
                Afvigelse {flag.deviationPoints} %-point
              </span>
            </div>
            <p className="hf-type-small text-text-secondary">Denne vare: {fmt(flag.split as EnergySplit)}</p>
            <p className="hf-type-small text-text-secondary">
              Øvrige ({flag.groupSize - 1}): {fmt(flag.referenceSplit as EnergySplit)}
            </p>
            <div>
              <ReviewEnergySplitButton flagId={flag.id} />
            </div>
          </div>
        ))
      )}
    </section>
  );
}

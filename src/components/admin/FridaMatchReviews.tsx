import { prisma } from "@/lib/prisma";
import { FridaMatchChoice, FridaMatchReset, type FridaMatchCandidate } from "@/components/admin/FridaMatchChoice";

// Admin "Usikkerheder" → Frida-match (docs/DECISIONS.md 2026-10-10): varer
// uden energimærkning, hvor robotten "frida-estimates" ikke selv kunne vælge
// Frida-vare. Valget gælder alle varer med samme produkttype, tilstand og
// kendetegn, og robotten kører straks bagefter.
export async function FridaMatchReviews() {
  const [open, decided] = await Promise.all([
    prisma.fridaEstimateReview.findMany({ where: { decidedAt: null }, orderBy: { productCount: "desc" }, take: 300 }),
    prisma.fridaEstimateReview.findMany({ where: { decidedAt: { not: null } }, orderBy: { decidedAt: "desc" }, take: 100 }),
  ]);
  const ids = [...new Set([...open, ...decided].flatMap((r) => [...r.candidateIds, r.chosenFridaProductId ?? ""]).filter(Boolean))];
  const frida = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, kcalPer100g: true, proteinPer100g: true, carbsPer100g: true, fatPer100g: true },
  });
  const byId = new Map<string, FridaMatchCandidate>(
    frida.map((p) => [p.id, { id: p.id, name: p.name, kcal: p.kcalPer100g, protein: p.proteinPer100g, carbs: p.carbsPer100g, fat: p.fatPer100g }]),
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="hf-type-body hf-type-strong uppercase tracking-wide text-text-muted">Frida-match ({open.length})</h2>
      <p className="hf-type-body text-text-secondary">
        Varer uden energimærkning, hvor flere Frida-varer passer på produkttypen, eller hvor tilstand, fedtprocent eller
        alkohol ikke passer på nogen. Vælg den Frida-vare, varerne skal have tal fra (vist med ∼), eller &quot;Ingen
        passer&quot;. Valget gælder alle varer i gruppen.
      </p>
      {open.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen åbne Frida-match.</p>
      ) : (
        open.map((review) => (
          <div key={review.id} className="hf-panel flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <p className="hf-type-body hf-type-strong text-hf-black">{review.typeLabel}</p>
              <span className="hf-type-small shrink-0 rounded-full bg-hf-tan px-2 py-0.5 text-hf-black">
                {review.productCount} {review.productCount === 1 ? "vare" : "varer"}
              </span>
            </div>
            <p className="hf-type-small text-text-secondary">
              {review.reason}. Fx {review.exampleNames.join(", ")}
            </p>
            <FridaMatchChoice
              reviewId={review.id}
              candidates={review.candidateIds.map((id) => byId.get(id)).filter((c): c is FridaMatchCandidate => !!c)}
            />
          </div>
        ))
      )}
      {decided.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="hf-type-small hf-type-strong text-hf-black">Valgt af admin</h3>
          {decided.map((review) => (
            <div key={review.id} className="hf-type-small flex items-center justify-between gap-3 text-hf-black">
              <span>
                {review.typeLabel} ({review.exampleNames[0] ?? ""}) →{" "}
                {review.chosenFridaProductId ? byId.get(review.chosenFridaProductId)?.name ?? "ukendt Frida-vare" : "Ingen passer"}
              </span>
              <FridaMatchReset reviewId={review.id} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

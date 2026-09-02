import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { PendingImageCard } from "@/components/admin/PendingImageCard";

// Possible duplicates: two products sharing the same name (case-insensitive)
// — the schema's Barcode.code is a primary key, so two products can never
// literally share one barcode row; a same-name pair is the closest real
// signal without a dedicated fuzzy-matching pipeline. Products that
// otherwise match but have differing macros/ingredients are flagged as a
// data conflict rather than a plain duplicate.
async function findDuplicateGroups() {
  const products = await prisma.product.findMany({
    include: { brand: true },
    orderBy: { name: "asc" },
  });
  const byName = new Map<string, typeof products>();
  for (const p of products) {
    const key = p.name.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), p]);
  }
  return [...byName.values()].filter((group) => group.length > 1);
}

function macrosDiffer(a: { kcalPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; ingredientsText: string | null }, b: typeof a) {
  return (
    a.kcalPer100g !== b.kcalPer100g ||
    a.proteinPer100g !== b.proteinPer100g ||
    a.carbsPer100g !== b.carbsPer100g ||
    a.fatPer100g !== b.fatPer100g ||
    (a.ingredientsText ?? "") !== (b.ingredientsText ?? "")
  );
}

export default async function AdminWarningsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const [duplicateGroups, pendingImages] = await Promise.all([
    findDuplicateGroups(),
    prisma.product.findMany({ where: { imageStatus: "PENDING" }, include: { brand: true }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Advarsler</h1>
        <p className="text-sm text-text-secondary">
          Nye produkter med samme navn (mulige dubletter), konflikter i energifordeling/ingrediensliste, og
          billeder der ikke lever op til kvalitetskravet.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Mulige dubletter ({duplicateGroups.length})
        </h2>
        {duplicateGroups.length === 0 ? (
          <p className="text-sm text-text-secondary">Ingen produkter med samme navn fundet.</p>
        ) : (
          duplicateGroups.map((group) => {
            const conflict = group.some((p, i) => i > 0 && macrosDiffer(group[0], p));
            return (
              <div key={group[0].name} className="rounded-lg border border-border-strong bg-surface-2 p-4">
                <p className="mb-2 flex items-center gap-2 font-medium text-text-primary">
                  {group[0].name}
                  {conflict && (
                    <span className="rounded-full bg-hf-red-dark px-2 py-0.5 text-xs text-hf-white">
                      Data matcher ikke
                    </span>
                  )}
                </p>
                <div className="flex flex-col gap-2">
                  {group.map((p) => (
                    <Link
                      key={p.id}
                      href={`/admin/products/${p.id}`}
                      className="flex items-center justify-between rounded-md border border-border-strong px-3 py-2 text-sm hover:border-hf-green"
                    >
                      <span>
                        {p.brand?.name ? `${p.brand.name} · ` : ""}
                        {p.status} · {Math.round(p.kcalPer100g)} kcal · P {p.proteinPer100g}g · K {p.carbsPer100g}g · F{" "}
                        {p.fatPer100g}g
                      </span>
                      <span className="text-xs text-hf-green-dark underline">Åbn / merge</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Billeder til godkendelse ({pendingImages.length})
        </h2>
        {pendingImages.length === 0 ? (
          <p className="text-sm text-text-secondary">Ingen billeder afventer godkendelse.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pendingImages.map((product) => (
              <PendingImageCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

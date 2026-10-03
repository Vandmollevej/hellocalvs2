import { prisma } from "@/lib/prisma";
import { certificationFiltersFromLabels, hasCertificationFilters } from "@/lib/label-certifications";

// Gemmer mærkninger læst fra emballagen/Open Food Facts i ProductFilters
// (docs/DECISIONS.md 2026-10-02). Tilføjer kun: et felt, der allerede er
// udfyldt (fx af butiksimporten eller admin), overskrives aldrig.
export async function addCertificationFilters(productId: string, labels: readonly string[]) {
  const read = certificationFiltersFromLabels(labels);
  if (!hasCertificationFilters(read)) return [];
  const existing = await prisma.productFilters.findUnique({
    where: { productId },
    select: { organic: true, keyhole: true, wholeGrain: true, animalWelfare: true, certifications: true },
  });
  const merge = (current: string[] | undefined, next: string[]) => Array.from(new Set([...(current ?? []), ...next]));
  const data = {
    organic: existing?.organic || read.organic,
    keyhole: existing?.keyhole || read.keyhole,
    wholeGrain: existing?.wholeGrain || read.wholeGrain,
    animalWelfare: merge(existing?.animalWelfare, read.animalWelfare),
    certifications: merge(existing?.certifications, read.certifications),
  };
  await prisma.productFilters.upsert({ where: { productId }, update: data, create: { productId, ...data } });
  return [read.organic, read.keyhole, read.wholeGrain, ...read.animalWelfare, ...read.certifications].filter(
    (value): value is string => Boolean(value),
  );
}

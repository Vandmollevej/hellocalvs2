import { prisma } from "@/lib/prisma";

// Natlig robot "energy-split-check" (job-nøgle "energy-split-check",
// docs/DECISIONS.md 2026-10-07): varer med samme brand, produkttype, serie,
// variant og smag, der kun adskiller sig på mængde, skal have (næsten) samme
// energifordeling. Afviger en vares fordeling (% af kcal fra protein/
// kulhydrat/fedt) mere end DEVIATION_POINTS procentpoint fra de andre i
// gruppen, får den et flag i admin "Usikkerheder". Varen deaktiveres ikke.

export const DEVIATION_POINTS = 8;

export type EnergySplit = { protein: number; carbs: number; fat: number };

type Candidate = {
  id: string;
  groupKey: string;
  split: EnergySplit;
  fingerprint: string;
};

export function energySplit(proteinG: number, carbsG: number, fatG: number): EnergySplit | null {
  const protein = proteinG * 4;
  const carbs = carbsG * 4;
  const fat = fatG * 9;
  const total = protein + carbs + fat;
  if (!Number.isFinite(total) || total < 1) return null;
  return { protein: (protein / total) * 100, carbs: (carbs / total) * 100, fat: (fat / total) * 100 };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function referenceOf(others: Candidate[]): EnergySplit {
  return {
    protein: median(others.map((o) => o.split.protein)),
    carbs: median(others.map((o) => o.split.carbs)),
    fat: median(others.map((o) => o.split.fat)),
  };
}

export function splitDeviation(own: EnergySplit, reference: EnergySplit): number {
  return Math.max(
    Math.abs(own.protein - reference.protein),
    Math.abs(own.carbs - reference.carbs),
    Math.abs(own.fat - reference.fat),
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const roundSplit = (s: EnergySplit): EnergySplit => ({ protein: round1(s.protein), carbs: round1(s.carbs), fat: round1(s.fat) });
const norm = (value: string | null) => (value ?? "").trim().toLowerCase();

export async function checkEnergySplits(): Promise<string> {
  const products = await prisma.product.findMany({
    where: {
      productType: { not: null },
      privateOwnerId: null,
      status: "APPROVED",
      discontinued: false,
      kcalPer100g: { gt: 0 },
    },
    select: {
      id: true,
      brandId: true,
      productType: true,
      subbrand: true,
      variant: true,
      flavor: true,
      kcalPer100g: true,
      proteinPer100g: true,
      carbsPer100g: true,
      fatPer100g: true,
    },
  });

  const groups = new Map<string, Candidate[]>();
  for (const p of products) {
    const type = norm(p.productType);
    if (!type) continue;
    const split = energySplit(p.proteinPer100g, p.carbsPer100g, p.fatPer100g);
    if (!split) continue;
    const groupKey = [p.brandId ?? "", type, norm(p.subbrand), norm(p.variant), norm(p.flavor)].join("|");
    const list = groups.get(groupKey) ?? [];
    list.push({
      id: p.id,
      groupKey,
      split,
      fingerprint: [p.kcalPer100g, p.proteinPer100g, p.carbsPer100g, p.fatPer100g].join("|"),
    });
    groups.set(groupKey, list);
  }

  const flagged = new Map<string, { deviation: number; split: EnergySplit; reference: EnergySplit; size: number; fingerprint: string }>();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    for (const member of members) {
      const reference = referenceOf(members.filter((m) => m.id !== member.id));
      const deviation = splitDeviation(member.split, reference);
      if (deviation > DEVIATION_POINTS) {
        flagged.set(member.id, {
          deviation: round1(deviation),
          split: roundSplit(member.split),
          reference: roundSplit(reference),
          size: members.length,
          fingerprint: member.fingerprint,
        });
      }
    }
  }

  const existing = await prisma.productEnergySplitFlag.findMany({
    select: { productId: true, fingerprint: true, reviewedAt: true },
  });
  const existingById = new Map(existing.map((e) => [e.productId, e]));

  let created = 0;
  let updated = 0;
  for (const [productId, f] of flagged) {
    const data = {
      deviationPoints: f.deviation,
      split: f.split,
      referenceSplit: f.reference,
      groupSize: f.size,
      fingerprint: f.fingerprint,
    };
    const prev = existingById.get(productId);
    if (!prev) {
      await prisma.productEnergySplitFlag.create({ data: { productId, ...data } });
      created += 1;
    } else {
      // Gennemgået og uændret: forbliver gennemgået. Ændrede tal → åbnes igen.
      const changed = prev.fingerprint !== f.fingerprint;
      await prisma.productEnergySplitFlag.update({
        where: { productId },
        data: { ...data, ...(changed ? { reviewedAt: null } : {}) },
      });
      updated += 1;
    }
  }

  const stale = existing.filter((e) => !flagged.has(e.productId)).map((e) => e.productId);
  if (stale.length) await prisma.productEnergySplitFlag.deleteMany({ where: { productId: { in: stale } } });

  return `${products.length} varer, ${flagged.size} afviger (${created} nye, ${updated} opdateret), ${stale.length} ryddet`;
}

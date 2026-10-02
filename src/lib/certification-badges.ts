// Certifikater/mærkninger der vises som logoer under energifordelingen på
// produktsiden (opgave 29). Kilden er ProductFilters (docs/DECISIONS.md
// 2026-09-27): udfyldt tekst = mærket findes, og teksten er det viste ord.

export type CertificationFilters = {
  organic?: string | null;
  keyhole?: string | null;
  wholeGrain?: string | null;
  animalWelfare?: string[] | null;
  certifications?: string[] | null;
};

export type CertificationKind =
  | "organic"
  | "keyhole"
  | "wholeGrain"
  | "animalWelfare"
  | "msc"
  | "asc"
  | "fairtrade"
  | "rainforest"
  | "generic";

// imageUrl = fritskrabet mærke fra det natlige mærkat-job (ProductLabel,
// docs/DECISIONS.md 2026-10-02); vises i stedet for det stiliserede logo.
export type CertificationBadge = { kind: CertificationKind; label: string; imageUrl?: string | null };

export type ProductLabelView = { key: string; name: string; category: string; imageUrl: string | null; confidence: number };

// Mærkater vises fra 0,8 — samme grænse som udfyldning af filtre.
export const LABEL_SHOW_MIN_CONFIDENCE = 0.8;

function kindForLabel(label: ProductLabelView): CertificationKind {
  if (label.key === "keyhole") return "keyhole";
  if (label.key === "whole-grain") return "wholeGrain";
  if (label.key.startsWith("organic-")) return "organic";
  if (label.category === "ANIMAL_WELFARE") return "animalWelfare";
  return kindForCertification(label.name);
}

function kindForCertification(label: string): CertificationKind {
  const value = label.toLowerCase();
  if (value.includes("msc")) return "msc";
  if (value.includes("asc")) return "asc";
  if (value.includes("fairtrade")) return "fairtrade";
  if (value.includes("rainforest")) return "rainforest";
  if (value.includes("økolog") || value.includes("organic") || value.includes("bio")) return "organic";
  return "generic";
}

export function certificationBadges(
  filters: CertificationFilters | null | undefined,
  labels: ProductLabelView[] | null | undefined = null,
): CertificationBadge[] {
  if (!filters && !labels?.length) return [];
  filters ??= {};
  const badges: CertificationBadge[] = [];
  const text = (value?: string | null) => value?.trim() || null;
  const organic = text(filters.organic);
  if (organic) badges.push({ kind: "organic", label: organic });
  const keyhole = text(filters.keyhole);
  if (keyhole) badges.push({ kind: "keyhole", label: keyhole });
  const wholeGrain = text(filters.wholeGrain);
  if (wholeGrain) badges.push({ kind: "wholeGrain", label: wholeGrain });
  for (const label of filters.animalWelfare ?? []) {
    if (label.trim()) badges.push({ kind: "animalWelfare", label: label.trim() });
  }
  for (const label of filters.certifications ?? []) {
    if (label.trim()) badges.push({ kind: kindForCertification(label), label: label.trim() });
  }
  // Fundne mærkater: giver billede til et badge med samme navn, ellers et
  // eget badge (fx "Laktosefri", "QMilch"), så alle mærker på emballagen vises.
  for (const label of labels ?? []) {
    if (label.confidence < LABEL_SHOW_MIN_CONFIDENCE) continue;
    const match = badges.find((b) => b.label.toLowerCase() === label.name.toLowerCase());
    if (match) {
      if (label.imageUrl && !match.imageUrl) match.imageUrl = label.imageUrl;
      continue;
    }
    badges.push({ kind: kindForLabel(label), label: label.name, imageUrl: label.imageUrl });
  }
  const seen = new Set<string>();
  return badges.filter((badge) => {
    const key = badge.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

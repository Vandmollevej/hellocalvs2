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

export type CertificationBadge = { kind: CertificationKind; label: string };

function kindForCertification(label: string): CertificationKind {
  const value = label.toLowerCase();
  if (value.includes("msc")) return "msc";
  if (value.includes("asc")) return "asc";
  if (value.includes("fairtrade")) return "fairtrade";
  if (value.includes("rainforest")) return "rainforest";
  if (value.includes("økolog") || value.includes("organic") || value.includes("bio")) return "organic";
  return "generic";
}

export function certificationBadges(filters: CertificationFilters | null | undefined): CertificationBadge[] {
  if (!filters) return [];
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
  const seen = new Set<string>();
  return badges.filter((badge) => {
    const key = badge.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Certifikater/mærkninger der vises som logoer under energifordelingen på
// produktsiden (opgave 29). Kilden er ProductFilters (docs/DECISIONS.md
// 2026-09-27): udfyldt tekst = mærket findes, og teksten er det viste ord.
// Logofilerne ligger i public/certifications (se LOGO_FILES nedenfor).

export type CertificationFilters = {
  organic?: string | null;
  keyhole?: string | null;
  wholeGrain?: string | null;
  animalWelfare?: string[] | null;
  certifications?: string[] | null;
};

export type CertificationKind =
  | "organic"
  | "euOrganic"
  | "bioGermany"
  | "landbau"
  | "bioland"
  | "keyhole"
  | "wholeGrain"
  | "welfare1"
  | "welfare2"
  | "welfare3"
  | "animalProtection"
  | "naturSkaansom"
  | "msc"
  | "asc"
  | "fairtrade"
  | "rainforest"
  | "utz"
  | "generic";

export type CertificationBadge = { kind: CertificationKind; label: string };

// Kind → logofil (public/certifications). "generic" har ingen fil og vises som tekstmærke.
export const CERTIFICATION_LOGO_FILES: Record<Exclude<CertificationKind, "generic">, string> = {
  organic: "oekologimaerket.png",
  euOrganic: "eu-oekologi.png",
  bioGermany: "bio-tyskland.png",
  landbau: "oekologischer-landbau.png",
  bioland: "bioland.png",
  keyhole: "noeglehul.png",
  wholeGrain: "fuldkorn.png",
  welfare1: "bedre-dyrevelfaerd-1.png",
  welfare2: "bedre-dyrevelfaerd-2.png",
  welfare3: "bedre-dyrevelfaerd-3.png",
  animalProtection: "dyrenes-beskyttelse.png",
  naturSkaansom: "naturskaansom.png",
  msc: "msc.png",
  asc: "asc.png",
  fairtrade: "fairtrade.png",
  rainforest: "rainforest-alliance.png",
  utz: "utz.png",
};

export function certificationLogoSrc(kind: CertificationKind): string | null {
  return kind === "generic" ? null : `/certifications/${CERTIFICATION_LOGO_FILES[kind]}`;
}

function kindForOrganic(label: string): CertificationKind {
  const value = label.toLowerCase();
  if (value.includes("bioland")) return "bioland";
  if (value.includes("landbau")) return "landbau";
  if (value.includes("biologisch") || /\bbio\b/.test(value)) return "bioGermany";
  if (value.includes("eu") && !value.includes("økolog")) return "euOrganic";
  return "organic";
}

// "Bedre Dyrevelfærd 1/2/3" (hjerter), "Anbefalet af Dyrenes Beskyttelse".
function kindForAnimalWelfare(label: string): CertificationKind {
  const value = label.toLowerCase();
  if (value.includes("dyrenes beskyttelse")) return "animalProtection";
  if (value.includes("dyrevelfærd")) {
    const level = value.match(/[123]/)?.[0];
    if (level === "1") return "welfare1";
    if (level === "2") return "welfare2";
    if (level === "3") return "welfare3";
  }
  return "generic";
}

function kindForCertification(label: string): CertificationKind {
  const value = label.toLowerCase();
  if (/\bmsc\b/.test(value)) return "msc";
  if (/\basc\b/.test(value)) return "asc";
  if (value.includes("fairtrade") || value.includes("fair trade")) return "fairtrade";
  if (value.includes("rainforest")) return "rainforest";
  if (/\butz\b/.test(value)) return "utz";
  if (value.includes("bioland")) return "bioland";
  if (value.includes("naturskånsom") || value.includes("natur skånsom") || value.includes("naturskaansom")) return "naturSkaansom";
  if (value.includes("dyrenes beskyttelse") || value.includes("dyrevelfærd")) return kindForAnimalWelfare(label);
  if (value.includes("økolog") || value.includes("organic") || value.includes("bio")) return kindForOrganic(label);
  return "generic";
}

export function certificationBadges(filters: CertificationFilters | null | undefined): CertificationBadge[] {
  if (!filters) return [];
  const badges: CertificationBadge[] = [];
  const text = (value?: string | null) => value?.trim() || null;
  const organic = text(filters.organic);
  if (organic) badges.push({ kind: kindForOrganic(organic), label: organic });
  const keyhole = text(filters.keyhole);
  if (keyhole) badges.push({ kind: "keyhole", label: keyhole });
  const wholeGrain = text(filters.wholeGrain);
  if (wholeGrain) badges.push({ kind: "wholeGrain", label: wholeGrain });
  for (const label of filters.animalWelfare ?? []) {
    if (label.trim()) badges.push({ kind: kindForAnimalWelfare(label), label: label.trim() });
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

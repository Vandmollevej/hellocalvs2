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
  | "krav"
  | "naturland"
  | "vLabel"
  | "vegan"
  | "vegansk"
  | "tierwohl"
  | "haltungsform"
  | "heimischerAnbau"
  | "dlg"
  | "glutenFree"
  | "noChickCull"
  | "danskMaelk"
  | "pgi"
  | "granaPadano"
  | "generic";

// imageUrl = fritskrabet mærke fra det natlige mærkat-job (ProductLabel,
// docs/DECISIONS.md 2026-10-02); vises for mærker uden egen logofil.
export type CertificationBadge = { kind: CertificationKind; label: string; imageUrl?: string | null };

export type ProductLabelView = { key: string; name: string; category: string; imageUrl: string | null; confidence: number };

// Mærkater vises fra 0,8 — samme grænse som udfyldning af filtre.
export const LABEL_SHOW_MIN_CONFIDENCE = 0.8;

function kindForLabel(label: ProductLabelView): CertificationKind {
  if (label.key === "keyhole") return "keyhole";
  if (label.key === "whole-grain") return "wholeGrain";
  if (label.key === "organic-eu") return "euOrganic";
  if (label.key === "organic-de") return "bioGermany";
  if (label.key === "organic-dk") return "organic";
  if (label.key === "dyrenes-beskyttelse") return "animalProtection";
  if (label.key.startsWith("bedre-dyrevelfaerd-")) return kindForAnimalWelfare(`Bedre Dyrevelfærd ${label.key.slice(-1)}`);
  return kindForCertification(label.name);
}

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
  krav: "krav.png",
  naturland: "naturland.png",
  vLabel: "v-label.png",
  vegan: "vegan.png",
  vegansk: "vegansk.png",
  tierwohl: "tierwohl.png",
  haltungsform: "haltungsform.png",
  heimischerAnbau: "heimischer-anbau.png",
  dlg: "dlg.png",
  glutenFree: "glutenfri.png",
  noChickCull: "eier-ohne-kuekentoeten.png",
  danskMaelk: "dansk-maelk.png",
  pgi: "pgi.png",
  granaPadano: "grana-padano.png",
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
  if (value.includes("tierwohl")) return "tierwohl";
  if (value.includes("haltungsform")) return "haltungsform";
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
  if (/\bkrav\b/.test(value)) return "krav";
  if (value.includes("naturland")) return "naturland";
  if (value.includes("v-label") || value.includes("vlabel")) return "vLabel";
  if (value.includes("vegansk")) return "vegansk";
  if (value.includes("vegan")) return "vegan";
  if (value.includes("tierwohl")) return "tierwohl";
  if (value.includes("haltungsform")) return "haltungsform";
  if (value.includes("heimischer anbau")) return "heimischerAnbau";
  if (/\bdlg\b/.test(value)) return "dlg";
  if (value.includes("glutenfri") || value.includes("gluten free") || value.includes("gluten-free")) return "glutenFree";
  if (value.includes("kükentöten") || value.includes("kuekentoeten")) return "noChickCull";
  if (value.includes("dansk mælk") || value.includes("dansk maelk")) return "danskMaelk";
  if (/\b(?:pgi|pdo)\b/.test(value) || value.includes("beskyttet geografisk")) return "pgi";
  if (value.includes("grana padano")) return "granaPadano";
  if (value.includes("bioland")) return "bioland";
  if (value.includes("naturskånsom") || value.includes("natur skånsom") || value.includes("naturskaansom")) return "naturSkaansom";
  if (value.includes("dyrenes beskyttelse") || value.includes("dyrevelfærd")) return kindForAnimalWelfare(label);
  if (value.includes("økolog") || value.includes("organic") || value.includes("bio")) return kindForOrganic(label);
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

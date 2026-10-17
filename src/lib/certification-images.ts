// Peters egne certifikat-billeder (public/certifications, 256 px, kilde: NAS
// "Projektfiler (ikke app)\Certifikater"). Mærket vælges ud fra teksten på
// varen; findes intet billede, bruges de tegnede mærker som reserve.

const DIR = "/certifications";

const RULES: { test: RegExp; file: string }[] = [
  { test: /bioland/i, file: "bioland" },
  { test: /biologisch|bio\s*siegel/i, file: "biologisch" },
  { test: /saatgut/i, file: "bio-saatgut" },
  { test: /\beu\b.*(øko|organic|bio)|(øko|organic|bio).*\beu\b/i, file: "organic-eu" },
  { test: /økolog|øko|organic/i, file: "okologi" },
  { test: /\bbio\b/i, file: "bio" },
  { test: /nøglehul/i, file: "noeglehul" },
  { test: /fuldkorn/i, file: "fuldkorn" },
  { test: /fair\s?trade/i, file: "fairtrade" },
  { test: /\bmsc\b/i, file: "msc" },
  { test: /\basc\b/i, file: "asc" },
  { test: /rainforest/i, file: "rainforest" },
  { test: /\butz\b/i, file: "utz" },
  { test: /naturskån|natur skån/i, file: "naturskaansom" },
  { test: /anbefalet|dyrenes beskyttelse/i, file: "anbefalet-dyrenes-beskyttelse" },
  { test: /(^|\D)1\s*(-|\s)?\s*stjern|1\s*hjerte/i, file: "dyrevelfaerd-1" },
  { test: /(^|\D)2\s*(-|\s)?\s*stjern|2\s*hjerter/i, file: "dyrevelfaerd-2" },
  { test: /(^|\D)3\s*(-|\s)?\s*stjern|3\s*hjerter/i, file: "dyrevelfaerd-3" },
  { test: /plantebaseret/i, file: "plantebaseret" },
  { test: /beskyttet geografisk|\bpgi\b/i, file: "pgi" },
  { test: /dansk gris/i, file: "dansk-gris" },
  { test: /dansk mel/i, file: "dansk-mel" },
  { test: /glutenfri/i, file: "glutenfri" },
  { test: /vegan/i, file: "vegansk" },
];

export function certificationImage(label: string): string | null {
  const rule = RULES.find((entry) => entry.test.test(label));
  return rule ? `${DIR}/${rule.file}.png` : null;
}

// Reserve pr. type, når teksten ikke afgør det (fx "Øko" fra varenavnet).
const BY_KIND: Record<string, string> = {
  organic: "okologi",
  keyhole: "noeglehul",
  wholeGrain: "fuldkorn",
  msc: "msc",
  asc: "asc",
  fairtrade: "fairtrade",
  rainforest: "rainforest",
};

export function certificationImageForKind(kind: string, label: string): string | null {
  const byLabel = certificationImage(label);
  if (byLabel) return byLabel;
  const file = BY_KIND[kind];
  return file ? `${DIR}/${file}.png` : null;
}

// Fælles krav til admin-adgangskoder (oprettelse og nulstilling). Bruges både
// i formularen (live-tjekliste) og i API-ruterne, så reglerne kun står ét sted.
export const ADMIN_PASSWORD_MIN_LENGTH = 12;

export type AdminPasswordRule = { id: string; label: string; test: (password: string) => boolean };

export const ADMIN_PASSWORD_RULES: AdminPasswordRule[] = [
  { id: "length", label: `Mindst ${ADMIN_PASSWORD_MIN_LENGTH} tegn`, test: (p) => p.length >= ADMIN_PASSWORD_MIN_LENGTH },
  { id: "upper", label: "Mindst ét stort bogstav", test: (p) => /\p{Lu}/u.test(p) },
  { id: "lower", label: "Mindst ét lille bogstav", test: (p) => /\p{Ll}/u.test(p) },
  { id: "digit", label: "Mindst ét tal", test: (p) => /\d/.test(p) },
  { id: "symbol", label: "Mindst ét specialtegn (fx ! ? # -)", test: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
];

export function isAdminPasswordValid(password: string): boolean {
  return ADMIN_PASSWORD_RULES.every((rule) => rule.test(password));
}

export const ADMIN_PASSWORD_REQUIREMENTS_MESSAGE =
  "Adgangskoden skal have mindst 12 tegn og indeholde store og små bogstaver, tal og specialtegn";

// Mærker på produktcirklens venstre side (ejerens regel 2026-10-10).
//
// Nederst: certifikater, ét ad gangen opad, med økologi altid nederst. Øverst:
// advarsels-/kostikoner i prioriteret rækkefølge. Øverste række starter ud for
// cirklens top, men rykker opad (op til den grønne bjælke), når der ikke er
// plads, og æder derefter certifikaterne ét ad gangen — økologi sidst.

export const PRIORITY_BLOCKS = ["sugar", "allergens", "additives", "diets", "flags", "vegan"] as const;
export type PriorityBlock = (typeof PRIORITY_BLOCKS)[number];

export type AllergenDisplayMode = "contains" | "free" | "both";

export type DisplayPrefs = {
  /** Brugerens rækkefølge (øverst = højeste prioritet). */
  order: PriorityBlock[];
  /** Blokke der ikke findes som egne kolonner på brugeren. */
  sugar: boolean;
  diets: boolean;
  flags: boolean;
  vegan: boolean;
  allergenMode: Record<string, AllergenDisplayMode>;
};

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  order: [...PRIORITY_BLOCKS],
  sugar: false,
  diets: false,
  flags: false,
  vegan: false,
  allergenMode: {},
};

const MODES: AllergenDisplayMode[] = ["contains", "free", "both"];

/** Gør et gemt JSON-felt (evt. ældre/ugyldigt) til gyldige indstillinger. */
export function normalizeDisplayPrefs(stored: unknown): DisplayPrefs {
  const raw = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const seen = new Set<PriorityBlock>();
  const order: PriorityBlock[] = [];
  const rawOrder = Array.isArray(raw.order) ? raw.order : [];
  for (const key of rawOrder) {
    if ((PRIORITY_BLOCKS as readonly unknown[]).includes(key) && !seen.has(key as PriorityBlock)) {
      seen.add(key as PriorityBlock);
      order.push(key as PriorityBlock);
    }
  }
  for (const key of PRIORITY_BLOCKS) if (!seen.has(key)) order.push(key);

  const allergenMode: Record<string, AllergenDisplayMode> = {};
  if (raw.allergenMode && typeof raw.allergenMode === "object") {
    for (const [key, value] of Object.entries(raw.allergenMode as Record<string, unknown>)) {
      if (MODES.includes(value as AllergenDisplayMode)) allergenMode[key] = value as AllergenDisplayMode;
    }
  }
  return {
    order,
    sugar: raw.sugar === true,
    diets: raw.diets === true,
    flags: raw.flags === true,
    vegan: raw.vegan === true,
    allergenMode,
  };
}

/** Blokkene brugeren har aktiveret, i brugerens rækkefølge. */
export function activeBlocks(
  prefs: DisplayPrefs,
  columns: { showAllergens: boolean; showAdditives: boolean },
): PriorityBlock[] {
  const enabled: Record<PriorityBlock, boolean> = {
    sugar: prefs.sugar,
    allergens: columns.showAllergens,
    additives: columns.showAdditives,
    diets: prefs.diets,
    flags: prefs.flags,
    vegan: prefs.vegan,
  };
  return prefs.order.filter((block) => enabled[block]);
}

// Mål (px): ikon + mellemrum, og hvor langt over cirklens top rækken må rykke
// (cirklen står 46 px under appbaren, se AddProductView).
export const BADGE_SIZE_PX = 30;
export const BADGE_GAP_PX = 4;
const SLOT_PX = BADGE_SIZE_PX + BADGE_GAP_PX;
export const CIRCLE_HEIGHT_PX = 180;
export const MAX_LIFT_PX = 46;

export type CircleSlots = {
  /** Hvor mange øverste ikoner der vises (resten er skjult). */
  topVisible: number;
  /** Hvor mange certifikater der vises (nederst-op, økologi først). */
  certsVisible: number;
  /** Hvor mange px den øverste række er rykket op over cirklens top. */
  liftPx: number;
};

/**
 * Fordeler pladsen: øverste ikoner har altid førsteret. De rykker op til
 * MAX_LIFT_PX, og æder derefter certifikaterne ét ad gangen (økologi sidst).
 * `certCount` tæller alle certifikater inkl. økologi.
 */
export function allocateCircleSlots(topCount: number, certCount: number): CircleSlots {
  const capacity = Math.floor((CIRCLE_HEIGHT_PX + MAX_LIFT_PX + BADGE_GAP_PX) / SLOT_PX);
  const topVisible = Math.min(topCount, capacity);
  const certsVisible = Math.max(0, Math.min(certCount, capacity - topVisible));
  const defaultCapacity = Math.floor((CIRCLE_HEIGHT_PX + BADGE_GAP_PX) / SLOT_PX);
  const overflowSlots = Math.max(0, topVisible + certsVisible - defaultCapacity);
  const liftPx = Math.min(MAX_LIFT_PX, overflowSlots * SLOT_PX);
  return { topVisible, certsVisible, liftPx };
}

// ---- Øverste ikoner -------------------------------------------------------

export type TopBadge = { key: string; block: PriorityBlock; label: string; kind?: "free" };

export type BadgeFilters = {
  glutenFree?: string | null;
  lactoseFree?: string | null;
  sugarFree?: string | null;
  lowSugar?: string | null;
  noAddedSugar?: string | null;
  vegan?: string | null;
  vegetarian?: string | null;
  alcohol?: string | null;
};

export type TopBadgeInput = {
  blocks: PriorityBlock[];
  prefs: DisplayPrefs;
  /** Allergener varen indeholder, og de nøgler brugeren har slået fra. */
  allergens: string[];
  hiddenAllergens: Set<string>;
  additives: string[];
  filters: BadgeFilters | null | undefined;
  sugarPer100g: number | null;
  kcalPer100g: number | null;
  proteinPer100g: number | null;
  /** Oversætter/etiketter fra kalderen, så modulet ikke kender i18n. */
  text: {
    allergen: (key: string) => string;
    contains: (name: string) => string;
    free: (name: string) => string;
    sugar: (grams: number) => string;
    additives: (count: number) => string;
    highProtein: string;
    lowSugar: string;
    noAddedSugar: string;
    alcohol: string;
    sugarFree: string;
    vegetarian: string;
    vegan: string;
  };
};

// Allergener med en "fri for"-påstand på varen (ProductFilters).
const FREE_CLAIM: Record<string, keyof BadgeFilters> = { gluten: "glutenFree", milk: "lactoseFree" };

// EU-påstanden "høj på protein": mindst 20 % af energien fra protein.
function isHighProtein(kcal: number | null, protein: number | null) {
  return !!kcal && !!protein && kcal > 0 && (protein * 4) / kcal >= 0.2;
}

export function buildTopBadges(input: TopBadgeInput): TopBadge[] {
  const { prefs, filters, text } = input;
  const out: TopBadge[] = [];
  const claim = (key: keyof BadgeFilters) => !!filters?.[key]?.trim();

  for (const block of input.blocks) {
    if (block === "sugar") {
      if (input.sugarPer100g !== null) out.push({ key: "sugar", block, label: text.sugar(input.sugarPer100g) });
    } else if (block === "allergens") {
      for (const key of new Set([...input.allergens, ...Object.keys(FREE_CLAIM)])) {
        if (input.hiddenAllergens.has(key)) continue;
        const mode = prefs.allergenMode[key] ?? "contains";
        const name = text.allergen(key);
        if (input.allergens.includes(key) && mode !== "free") {
          out.push({ key: `allergen-${key}`, block, label: text.contains(name) });
        }
        const freeKey = FREE_CLAIM[key];
        if (freeKey && claim(freeKey) && mode !== "contains") {
          out.push({ key: `free-${key}`, block, label: text.free(name), kind: "free" });
        }
      }
    } else if (block === "additives") {
      if (input.additives.length) out.push({ key: "additives", block, label: text.additives(input.additives.length) });
    } else if (block === "diets") {
      if (isHighProtein(input.kcalPer100g, input.proteinPer100g)) {
        out.push({ key: "high-protein", block, label: text.highProtein });
      }
      if (claim("lowSugar")) out.push({ key: "low-sugar", block, label: text.lowSugar });
      if (claim("noAddedSugar")) out.push({ key: "no-added-sugar", block, label: text.noAddedSugar });
    } else if (block === "flags") {
      if (claim("alcohol") && /indehold/i.test(filters?.alcohol ?? "")) out.push({ key: "alcohol", block, label: text.alcohol });
      if (claim("sugarFree")) out.push({ key: "sugar-free", block, label: text.sugarFree });
      if (claim("vegetarian")) out.push({ key: "vegetarian", block, label: text.vegetarian });
    } else if (block === "vegan") {
      if (claim("vegan")) out.push({ key: "vegan", block, label: text.vegan });
    }
  }
  return out;
}

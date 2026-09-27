// Guide-builder (admin → Design → Guide-builder, docs/DECISIONS.md
// 2026-09-27): datamodel, faste byggeklodser og sanitering for de to
// fuldskærms-flows, der bygges i admin: startup-guiden og tooltips.
// Alt visuelt vælges KUN fra design.md's faste tokens og tekstroller — en
// opsætning kan aldrig indeholde en fri hex-farve eller en fri fontstørrelse.

import { TERMS_ANCHOR_IDS, type TermsAnchor } from "@/lib/terms-hints";

export type GuideKind = "startup" | "tooltips";
export const GUIDE_KINDS: GuideKind[] = ["startup", "tooltips"];

export type GuideLang = "da" | "en";
export type LocalizedText = { da: string; en: string };

// Baggrunde = de faste flade-farver fra design.md §3. `dark` styrer, at tekst
// og ikoner skifter til hvid på den flade.
export const GUIDE_BACKGROUNDS = [
  { id: "page", token: "--hf-color-page", hex: "#FAF8F3", label: { da: "Side (creme)", en: "Page (cream)" }, dark: false },
  { id: "surface", token: "--hf-color-surface", hex: "#FFFFFF", label: { da: "Hvid flade", en: "White surface" }, dark: false },
  { id: "card", token: "--hf-color-card", hex: "#EEE9DF", label: { da: "Kort (beige)", en: "Card (beige)" }, dark: false },
  { id: "nav", token: "--hf-color-nav", hex: "#DFD9CC", label: { da: "Navigation (tan)", en: "Navigation (tan)" }, dark: false },
  { id: "brand", token: "--hf-color-brand", hex: "#067A46", label: { da: "Brand-grøn", en: "Brand green" }, dark: true },
  { id: "appbar", token: "--hf-color-appbar", hex: "#35784A", label: { da: "Appbar-grøn", en: "Appbar green" }, dark: true },
  { id: "action", token: "--hf-color-action", hex: "#232323", label: { da: "Mørk (action)", en: "Dark (action)" }, dark: true },
] as const;
export type GuideBackgroundId = (typeof GUIDE_BACKGROUNDS)[number]["id"];

// Tekstelementer = de bindende tekstroller fra design.md §4.2.
export const GUIDE_TEXT_ROLES = [
  { id: "hero", className: "hf-type-hero", sample: "32 / 38 · 700", label: { da: "Hero-overskrift", en: "Hero heading" } },
  { id: "page-title", className: "hf-type-page-title", sample: "24 / 29 · 700", label: { da: "Sideoverskrift", en: "Page title" } },
  { id: "category-title", className: "hf-type-category-title", sample: "18 / 22 · 700", label: { da: "Underoverskrift", en: "Subheading" } },
  { id: "body-lg", className: "hf-type-body-lg", sample: "20 / 29 · 400", label: { da: "Stor brødtekst", en: "Large body" } },
  { id: "body", className: "hf-type-body", sample: "17 / 25 · 400", label: { da: "Brødtekst", en: "Body" } },
  { id: "body-sm", className: "hf-type-body-sm", sample: "15 / 22 · 400", label: { da: "Lille brødtekst", en: "Small body" } },
  { id: "caption", className: "hf-type-caption", sample: "13 / 18 · 400", label: { da: "Caption", en: "Caption" } },
] as const;
export type GuideTextRoleId = (typeof GUIDE_TEXT_ROLES)[number]["id"];

// Farvetemaer: færdige kombinationer af baggrund + accent (progress-bar,
// prikker). Vælges tema, får alle skærme temaets baggrund; en baggrund, der
// trækkes ind på en enkelt skærm, overstyrer derefter kun den skærm.
export const GUIDE_THEMES = [
  { id: "cream", background: "page", accent: "brand", label: { da: "Creme · grøn accent", en: "Cream · green accent" } },
  { id: "cream-dark", background: "page", accent: "action", label: { da: "Creme · sort accent", en: "Cream · black accent" } },
  { id: "white", background: "surface", accent: "brand", label: { da: "Hvid · grøn accent", en: "White · green accent" } },
  { id: "beige", background: "card", accent: "brand", label: { da: "Beige · grøn accent", en: "Beige · green accent" } },
  { id: "tan", background: "nav", accent: "action", label: { da: "Tan · sort accent", en: "Tan · black accent" } },
  { id: "green", background: "brand", accent: "surface", label: { da: "Brand-grøn · hvid accent", en: "Brand green · white accent" } },
] as const satisfies ReadonlyArray<{ id: string; background: GuideBackgroundId; accent: GuideBackgroundId; label: LocalizedText }>;
export type GuideThemeId = (typeof GUIDE_THEMES)[number]["id"];

export type GuideTextElement = {
  id: string;
  type: "text";
  role: GuideTextRoleId;
  text: LocalizedText;
  align: "left" | "center";
};

// Indstillingsrække (kun startup-guiden): label + stepper −/tal/+ som i
// HelloFresh-referencen "Hvor mange skal spise?".
export type GuideSettingElement = {
  id: string;
  type: "setting";
  label: LocalizedText;
  hint: LocalizedText;
  value: number;
  min: number;
  max: number;
};

export type GuideElement = GuideTextElement | GuideSettingElement;

// "Vilkår og betingelser"-bjælken under hvert startup-trin
// (docs/DECISIONS.md 2026-09-27): egen tekst pr. trin + det afsnit i
// /betingelser, som "Gå til vilkår og betingelser" fører til. Tomme linjer
// i teksten adskiller afsnit.
export type GuideTerms = { text: LocalizedText; anchor: TermsAnchor };

export type GuideScreen = {
  id: string;
  // null = temaets baggrund.
  background: GuideBackgroundId | null;
  // Trinnavn i progress-baren (startup) — ignoreres for tooltips.
  stepLabel: LocalizedText;
  // URL eller nedskaleret data-URL. Fast højde/dimension i visningen, så et
  // skiftet billede aldrig ændrer layoutet.
  image: string | null;
  elements: GuideElement[];
  // Kun startup-guiden; altid null for tooltips.
  terms: GuideTerms | null;
};

export type GuideConfig = {
  kind: GuideKind;
  theme: GuideThemeId;
  screens: GuideScreen[];
};

// Fast billedgeometri (402 px referencebredde). Startup: fuldbredde som
// referencen "Bestil din lækre måltidskasse" (920×517 ≈ 16:9). Tooltips:
// fast 4:3-felt med 8 px radius (behøver ikke være rundt).
export const GUIDE_IMAGE_SIZE = {
  startup: { width: 402, height: 226 },
  tooltips: { width: 280, height: 210 },
} as const;

export const GUIDE_MAX_SCREENS = 12;
export const GUIDE_MAX_ELEMENTS = 12;
const MAX_TEXT = 600;
const MAX_TERMS_TEXT = 3000;

// Standardtekst til et nyt startup-trin, så bjælken aldrig står tom.
export function defaultGuideTerms(): GuideTerms {
  return {
    anchor: "hvad-er-hello-cal",
    text: {
      da: "Dine svar i startguiden bruges kun til at tilpasse Hello Cal til dig og hører til din egen konto. Du kan altid ændre dem senere under Indstillinger.\n\nHello Cal er et værktøj, ikke en læge. Tal og beregninger er vejledende og erstatter ikke rådgivning fra en sundhedsperson.",
      en: "Your answers in the startup guide are only used to tailor Hello Cal to you and belong to your own account. You can always change them later in Settings.\n\nHello Cal is a tool, not a doctor. Numbers and calculations are guidance and do not replace advice from a health professional.",
    },
  };
}
const MAX_IMAGE = 400_000;

export function backgroundById(id: GuideBackgroundId) {
  return GUIDE_BACKGROUNDS.find((bg) => bg.id === id) ?? GUIDE_BACKGROUNDS[0];
}

export function themeById(id: GuideThemeId) {
  return GUIDE_THEMES.find((theme) => theme.id === id) ?? GUIDE_THEMES[0];
}

export function textRoleById(id: GuideTextRoleId) {
  return GUIDE_TEXT_ROLES.find((role) => role.id === id) ?? GUIDE_TEXT_ROLES[4];
}

export function screenBackground(config: GuideConfig, screen: GuideScreen) {
  return backgroundById(screen.background ?? themeById(config.theme).background);
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newTextElement(role: GuideTextRoleId): GuideTextElement {
  const label = textRoleById(role).label;
  return { id: newId("txt"), type: "text", role, text: { da: label.da, en: label.en }, align: "left" };
}

export function newSettingElement(): GuideSettingElement {
  return {
    id: newId("set"),
    type: "setting",
    label: { da: "Antal voksne", en: "Adults" },
    hint: { da: "", en: "" },
    value: 2,
    min: 0,
    max: 10,
  };
}

// En ny skærm starter tom og uden valgt baggrund: i builderen trækkes først
// en baggrund ind, derefter fonte/elementer.
export function newScreen(kind: GuideKind, index: number): GuideScreen {
  return {
    id: newId("scr"),
    background: null,
    stepLabel: kind === "startup" ? { da: `Trin ${index + 1}`, en: `Step ${index + 1}` } : { da: `Tip ${index + 1}`, en: `Tip ${index + 1}` },
    image: null,
    elements: [],
    terms: kind === "startup" ? defaultGuideTerms() : null,
  };
}

function sampleScreen(
  id: string,
  stepLabel: LocalizedText,
  heading: LocalizedText,
  body: LocalizedText,
  headingRole: GuideTextRoleId,
  terms: GuideTerms | null = null,
): GuideScreen {
  return {
    id,
    background: "page",
    stepLabel,
    image: null,
    elements: [
      { id: `${id}-h`, type: "text", role: headingRole, align: "left", text: heading },
      { id: `${id}-b`, type: "text", role: headingRole === "hero" ? "body-lg" : "body", align: "left", text: body },
    ],
    terms,
  };
}

export function defaultGuideConfig(kind: GuideKind): GuideConfig {
  if (kind === "startup") {
    return {
      kind,
      theme: "cream",
      screens: [
        {
          id: "scr-about",
          background: "page",
          stepLabel: { da: "Om dig", en: "About you" },
          image: null,
          elements: [
            { id: "txt-a1", type: "text", role: "page-title", align: "left", text: { da: "Hvor mange skal spise?", en: "How many are eating?" } },
            {
              id: "txt-a2",
              type: "text",
              role: "body",
              align: "left",
              text: { da: "Tæl tallerkenerne, så klarer vi portionerne.", en: "Count the plates and we'll handle the portions." },
            },
            { id: "set-a1", type: "setting", label: { da: "Antal voksne", en: "Adults" }, hint: { da: "", en: "" }, value: 2, min: 1, max: 10 },
            { id: "set-a2", type: "setting", label: { da: "Børn", en: "Children" }, hint: { da: "(alder 0-12 år)", en: "(age 0-12)" }, value: 0, min: 0, max: 10 },
          ],
          terms: {
            anchor: "hvad-er-hello-cal",
            text: {
              da: "Antallet bruges kun til at beregne portioner i Hello Cal. Det hører til din egen konto og deles ikke med andre.\n\nDu kan altid ændre det senere under Indstillinger.",
              en: "The number is only used to calculate portions in Hello Cal. It belongs to your own account and is not shared with anyone.\n\nYou can always change it later in Settings.",
            },
          },
        },
        sampleScreen(
          "scr-goal",
          { da: "Mål", en: "Goal" },
          { da: "Hvad er dit mål?", en: "What is your goal?" },
          { da: "Vi tilpasser dagens kalorier til dit mål.", en: "We adjust your daily calories to your goal." },
          "page-title",
          {
            anchor: "ansvar",
            text: {
              da: "Dit kaloriemål er beregnet ud fra de oplysninger, du giver. Det er vejledende og kan indeholde fejl, og vi kan ikke love et bestemt resultat.\n\nEr du gravid, ammer, har en spiseforstyrrelse, diabetes eller en anden tilstand, hvor kost og vægt betyder noget for dit helbred, så tal med din læge, før du ændrer din kost.",
              en: "Your calorie goal is calculated from the information you provide. It is guidance, may contain errors, and we cannot promise a specific result.\n\nIf you are pregnant, breastfeeding, have an eating disorder, diabetes or another condition where diet and weight matter for your health, talk to your doctor before changing your diet.",
            },
          },
        ),
        sampleScreen(
          "scr-done",
          { da: "Klar", en: "Ready" },
          { da: "Du er klar", en: "You are all set" },
          { da: "Du kan altid ændre det under Indstillinger.", en: "You can always change this in Settings." },
          "page-title",
          {
            anchor: "parterne",
            text: {
              da: "Når du bruger Hello Cal, gælder vores betingelser. Dansk ret og danske forbrugerregler gælder fuldt ud.\n\nDine data er dine. Vi bruger dem til at levere Hello Cal til dig og ikke til annoncer. Hvordan vi behandler dine oplysninger, står i privatlivspolitikken.",
              en: "When you use Hello Cal, our terms apply. Danish law and Danish consumer rules apply in full.\n\nYour data is yours. We use it to provide Hello Cal to you, not for ads. How we process your information is described in the privacy policy.",
            },
          },
        ),
      ],
    };
  }
  return {
    kind,
    theme: "cream",
    screens: [
      {
        id: "scr-tip1",
        background: "page",
        stepLabel: { da: "Tip 1", en: "Tip 1" },
        image: null,
        elements: [
          { id: "txt-t1", type: "text", role: "hero", align: "left", text: { da: "Altid travlt? Lad os hjælpe", en: "Always busy? Let us help" } },
          {
            id: "txt-t2",
            type: "text",
            role: "body-lg",
            align: "left",
            text: { da: "Scan stregkoden, så finder vi resten.", en: "Scan the barcode and we'll find the rest." },
          },
        ],
        terms: null,
      },
      sampleScreen("scr-tip2", { da: "Tip 2", en: "Tip 2" }, { da: "Se hele dagen på ét blik", en: "Your whole day at a glance" }, { da: "Kalenderen viser, om du holder dit mål.", en: "The calendar shows whether you are on target." }, "hero"),
    ],
  };
}

function str(value: unknown, max = MAX_TEXT) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function localized(value: unknown): LocalizedText {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return { da: str(record.da), en: str(record.en) };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function int(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeImage(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.length > MAX_IMAGE) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (/^https:\/\//.test(value)) return value;
  if (/^data:image\/(jpeg|png|webp);base64,/.test(value)) return value;
  return null;
}

const BACKGROUND_IDS = GUIDE_BACKGROUNDS.map((bg) => bg.id);
const ROLE_IDS = GUIDE_TEXT_ROLES.map((role) => role.id);
const THEME_IDS = GUIDE_THEMES.map((theme) => theme.id);

function sanitizeElement(value: unknown, kind: GuideKind): GuideElement | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = str(record.id, 40) || newId("el");
  if (record.type === "setting") {
    if (kind !== "startup") return null;
    const min = int(record.min, 0, 0, 99);
    const max = int(record.max, 10, min, 99);
    return { id, type: "setting", label: localized(record.label), hint: localized(record.hint), value: int(record.value, min, min, max), min, max };
  }
  if (record.type === "text") {
    return {
      id,
      type: "text",
      role: oneOf(record.role, ROLE_IDS, "body"),
      text: localized(record.text),
      align: record.align === "center" ? "center" : "left",
    };
  }
  return null;
}

// Ældre opsætninger uden vilkår får standardteksten, så hvert startup-trin
// altid har bjælken.
function sanitizeTerms(value: unknown): GuideTerms {
  if (!value || typeof value !== "object") return defaultGuideTerms();
  const record = value as Record<string, unknown>;
  const raw = (record.text && typeof record.text === "object" ? record.text : {}) as Record<string, unknown>;
  const text = { da: str(raw.da, MAX_TERMS_TEXT), en: str(raw.en, MAX_TERMS_TEXT) };
  return { text, anchor: oneOf(record.anchor, TERMS_ANCHOR_IDS, "hvad-er-hello-cal") };
}

// Saniterer en opsætning fra klient eller database: ukendte farver/roller
// falder tilbage til standard, lister beskæres, billeder skal være relative,
// https eller en lille data-URL.
export function sanitizeGuideConfig(kind: GuideKind, value: unknown): GuideConfig {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const rawScreens = Array.isArray(record.screens) ? record.screens.slice(0, GUIDE_MAX_SCREENS) : [];
  const screens: GuideScreen[] = rawScreens.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const screen = raw as Record<string, unknown>;
    const elements = (Array.isArray(screen.elements) ? screen.elements.slice(0, GUIDE_MAX_ELEMENTS) : [])
      .map((el) => sanitizeElement(el, kind))
      .filter((el): el is GuideElement => el !== null);
    const stepLabel = localized(screen.stepLabel);
    return [
      {
        id: str(screen.id, 40) || newId("scr"),
        background: screen.background == null ? null : oneOf(screen.background, BACKGROUND_IDS, "page"),
        stepLabel: stepLabel.da || stepLabel.en ? stepLabel : { da: `Trin ${index + 1}`, en: `Step ${index + 1}` },
        image: sanitizeImage(screen.image),
        elements,
        terms: kind === "startup" ? sanitizeTerms(screen.terms) : null,
      },
    ];
  });
  if (screens.length === 0) return defaultGuideConfig(kind);
  return { kind, theme: oneOf(record.theme, THEME_IDS, "cream"), screens };
}

export function isGuideKind(value: unknown): value is GuideKind {
  return value === "startup" || value === "tooltips";
}

export function pick(text: LocalizedText, lang: GuideLang) {
  return text[lang] || text.da;
}

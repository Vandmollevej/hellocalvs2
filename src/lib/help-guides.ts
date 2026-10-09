import type { ChatbotLinkHref } from "@/lib/chatbot-knowledge";

// "Guide mig" i hjælpe-chatten: trin-for-trin-vejledning, hvor appen
// mørklægger skærmen og fremhæver det, brugeren skal trykke på. Registret er
// den eneste kilde: chatbotten vælger blandt id'erne, overlayet læser trinene,
// og help-guides.test.mjs fejler, hvis et trin peger på et `data-guide`-felt,
// som ikke længere findes i koden, eller en side, der ikke findes. Ny guide =
// nyt element her (+ `data-guide="…"` på knappen i UI'et).

export type HelpGuideStep = {
  // Værdien af `data-guide` på det element, der skal trykkes på.
  target: string;
  da: string;
  en: string;
};

export type HelpGuide = {
  id: string;
  // Siden guiden ender på (vises som understreget genvej i chatten).
  href: ChatbotLinkHref;
  steps: HelpGuideStep[];
};

const ADD_STEP: HelpGuideStep = {
  target: "add-fab",
  da: "Tryk på plus-knappen",
  en: "Tap the plus button",
};

export const HELP_GUIDES: HelpGuide[] = [
  {
    id: "log-weight",
    href: "/weight/create",
    steps: [ADD_STEP, { target: "add-weight", da: "Vælg vægt", en: "Choose weight" }],
  },
  {
    id: "log-water",
    href: "/water/create",
    steps: [ADD_STEP, { target: "add-water", da: "Vælg vand", en: "Choose water" }],
  },
  {
    id: "scan-barcode",
    href: "/camera?mode=product",
    steps: [ADD_STEP, { target: "add-camera", da: "Vælg kameraet", en: "Choose the camera" }],
  },
  {
    id: "voice-log",
    href: "/voice",
    steps: [ADD_STEP, { target: "add-microphone", da: "Vælg mikrofonen", en: "Choose the microphone" }],
  },
  {
    id: "search-food",
    href: "/search",
    steps: [ADD_STEP, { target: "add-search", da: "Vælg søg", en: "Choose search" }],
  },
  {
    id: "create-dish",
    href: "/create-dish",
    steps: [ADD_STEP, { target: "add-ownDishes", da: "Vælg egne retter", en: "Choose your dishes" }],
  },
  {
    id: "body-measurements",
    href: "/profile/body-measurements",
    steps: [ADD_STEP, { target: "add-bodyMeasurements", da: "Vælg kropsmål", en: "Choose body measurements" }],
  },
  {
    id: "goals",
    href: "/profile/goals",
    steps: [ADD_STEP, { target: "add-targetWeight", da: "Vælg målsætning", en: "Choose goal" }],
  },
  {
    id: "calendar",
    href: "/calendar",
    steps: [{ target: "nav-kalender", da: "Tryk på Kalender i bundmenuen", en: "Tap Calendar in the bottom menu" }],
  },
  {
    id: "statistics",
    href: "/statistics",
    steps: [{ target: "nav-statistik", da: "Tryk på Statistik i bundmenuen", en: "Tap Statistics in the bottom menu" }],
  },
];

export const HELP_GUIDE_IDS = HELP_GUIDES.map((guide) => guide.id);

// Gemmes i ChatbotMessage.links som "guide:<id>" (ingen databaseændring).
const GUIDE_PREFIX = "guide:";

export function helpGuideById(id: unknown): HelpGuide | null {
  return HELP_GUIDES.find((guide) => guide.id === id) ?? null;
}

export function helpGuideLinkValue(id: string) {
  return `${GUIDE_PREFIX}${id}`;
}

export function helpGuideIdFromLink(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(GUIDE_PREFIX)) return null;
  const id = value.slice(GUIDE_PREFIX.length);
  return helpGuideById(id) ? id : null;
}

export function isHelpGuideLink(value: unknown): boolean {
  return helpGuideIdFromLink(value) !== null;
}

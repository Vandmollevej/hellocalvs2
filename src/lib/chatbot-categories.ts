// Kategorier for spørgsmål til hjælpe-chatbotten (docs/DECISIONS.md
// 2026-10-02). Delt mellem server (AI-skema), app og admin. Rækkefølgen er
// den, admin viser kategorierne i, når der ikke sorteres efter antal.
export const CHATBOT_CATEGORIES = [
  "GETTING_STARTED",
  "FOOD_LOGGING",
  "PRODUCTS_SCANNING",
  "DISHES",
  "GOALS_NUTRITION",
  "WEIGHT_STATS",
  "ACCOUNT_LOGIN",
  "SUBSCRIPTION_PAYMENT",
  "PRIVACY_DATA",
  "INTEGRATIONS",
  "FAMILY",
  "BUG",
  "OTHER",
] as const;

export type ChatbotCategoryKey = (typeof CHATBOT_CATEGORIES)[number];

export function isChatbotCategory(value: unknown): value is ChatbotCategoryKey {
  return typeof value === "string" && (CHATBOT_CATEGORIES as readonly string[]).includes(value);
}

export const CHATBOT_CATEGORY_LABELS: Record<ChatbotCategoryKey, { da: string; en: string }> = {
  GETTING_STARTED: { da: "Kom i gang", en: "Getting started" },
  FOOD_LOGGING: { da: "Registrering af mad", en: "Logging food" },
  PRODUCTS_SCANNING: { da: "Varer og scanning", en: "Products and scanning" },
  DISHES: { da: "Retter og opskrifter", en: "Dishes and recipes" },
  GOALS_NUTRITION: { da: "Mål, kalorier og næring", en: "Goals, calories and nutrition" },
  WEIGHT_STATS: { da: "Vægt, vand og statistik", en: "Weight, water and statistics" },
  ACCOUNT_LOGIN: { da: "Konto og login", en: "Account and login" },
  SUBSCRIPTION_PAYMENT: { da: "Abonnement og betaling", en: "Subscription and payment" },
  PRIVACY_DATA: { da: "Data og privatliv", en: "Data and privacy" },
  INTEGRATIONS: { da: "Integrationer", en: "Integrations" },
  FAMILY: { da: "Familie", en: "Family" },
  BUG: { da: "Fejl i appen", en: "Bugs" },
  OTHER: { da: "Andet", en: "Other" },
};

// Beskrivelser til AI'en, så den vælger kategori ens hver gang.
export const CHATBOT_CATEGORY_HINTS: Record<ChatbotCategoryKey, string> = {
  GETTING_STARTED: "hvad appen er, introduktion, første skridt",
  FOOD_LOGGING: "tilføje, slette, flytte registreringer, stemme, kamera til måltider, offline",
  PRODUCTS_SCANNING: "stregkoder, varer der mangler, opret vare, forkerte varedata",
  DISHES: "egne retter, opskrifter, deling af retter, HelloFresh",
  GOALS_NUTRITION: "mål, kaloriemål, makroer, næringsstoffer, aktivitetsniveau",
  WEIGHT_STATS: "vægt, vand, kropsmål, søvn, statistik, kalender, forside",
  ACCOUNT_LOGIN: "login, adgangskode, Face ID, bekræftelsesmail, sprog, notifikationer, slet konto",
  SUBSCRIPTION_PAYMENT: "abonnement, Seriøs, pris, betaling, MobilePay, opsigelse, gavekoder, points",
  PRIVACY_DATA: "helbredsdata, privatliv, samtykke, Support-adgang, Hello Doc, eksport",
  INTEGRATIONS: "Apple Health, Health Connect, Withings, Google Health, Fitbit, Strava, andre apps",
  FAMILY: "familieabonnement, børneprofiler",
  BUG: "noget virker ikke, fejl, nedbrud",
  OTHER: "alt andet",
};

export function chatbotCategoryLabel(category: string | null | undefined, locale: "da" | "en" = "da") {
  if (!category || !isChatbotCategory(category)) return locale === "da" ? "Ukendt" : "Unknown";
  return CHATBOT_CATEGORY_LABELS[category][locale];
}

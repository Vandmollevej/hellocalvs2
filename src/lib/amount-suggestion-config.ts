// Indstillinger for mængde-robotten (scripts/amount-suggestion-agent og
// src/lib/amount-suggestion.ts), redigeret i /admin/robots og gemt i
// robot_configs.settings. Samme standarder og grænser står i agentens
// DEFAULT_SETTINGS/LIMITS — ret begge steder. Se docs/DECISIONS.md
// 2026-09-25 "Mængde-robot".

export const AMOUNT_SUGGESTION_ROBOT_KEY = "amount-suggestion";

export type AmountSuggestionSettings = {
  // App'en bruger forslagene til at stille mængde-slideren. Slået fra =
  // robotten regner stadig, men slideren starter som før (100 g/portion).
  useInApp: boolean;
  intervalMinutes: number;
  lookbackDays: number;
  halfLifeDays: number;
  minUsers: number;
  minSamples: number;
  perUserCap: number;
  trimPercent: number;
  priorStrength: number;
  personalWeight: number;
  personalHistory: number;
};

export const DEFAULT_AMOUNT_SUGGESTION_SETTINGS: AmountSuggestionSettings = {
  useInApp: true,
  intervalMinutes: 360,
  lookbackDays: 365,
  halfLifeDays: 90,
  minUsers: 3,
  minSamples: 3,
  perUserCap: 5,
  trimPercent: 5,
  priorStrength: 4,
  personalWeight: 1.5,
  personalHistory: 10,
};

type NumericKey = Exclude<keyof AmountSuggestionSettings, "useInApp">;

export const AMOUNT_SUGGESTION_FIELDS: {
  key: NumericKey;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
}[] = [
  {
    key: "intervalMinutes",
    label: "Kørsel hvert (minutter)",
    help: "Hvor ofte robotten genberegner alle forslag.",
    min: 15,
    max: 10080,
    step: 15,
  },
  {
    key: "lookbackDays",
    label: "Historik (dage)",
    help: "Registreringer og opskrifter ældre end dette tæller ikke med.",
    min: 7,
    max: 1825,
    step: 1,
  },
  {
    key: "halfLifeDays",
    label: "Halveringstid (dage)",
    help: "En mængde valgt for så mange dage siden vejer halvt så meget som en fra i dag. Følger skiftende vaner.",
    min: 1,
    max: 1825,
    step: 1,
  },
  {
    key: "minUsers",
    label: "Min. antal brugere",
    help: "Et fælles forslag for en vare gemmes først, når så mange forskellige brugere har valgt en mængde (anonymitet).",
    min: 2,
    max: 100,
    step: 1,
  },
  {
    key: "minSamples",
    label: "Min. antal valg",
    help: "Færre (vægtede) valg end dette giver ikke et forslag for varen; kategorien bruges i stedet.",
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: "perUserCap",
    label: "Maks. vægt pr. bruger",
    help: "En bruger tæller højst som så mange valg, så én storbruger ikke bestemmer for alle.",
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: "trimPercent",
    label: "Fjern yderpunkter (%)",
    help: "Andel i hver ende, der ses bort fra (fx tastefejl som 5000 g agurk).",
    min: 0,
    max: 25,
    step: 1,
  },
  {
    key: "priorStrength",
    label: "Kategoriens vægt",
    help: "Hvor mange valg kategoriens typiske mængde tæller som, når en vare har få data. Højere = mere forsigtig.",
    min: 0,
    max: 50,
    step: 0.5,
  },
  {
    key: "personalWeight",
    label: "Personlig overtagelse",
    help: "Antal egne valg, før brugerens egen vane vejer lige så meget som alle andres. Lavere = personlig vane tager hurtigere over.",
    min: 0.1,
    max: 20,
    step: 0.1,
  },
  {
    key: "personalHistory",
    label: "Egne seneste valg",
    help: "Hvor mange af brugerens egne seneste valg af varen der ses på.",
    min: 1,
    max: 50,
    step: 1,
  },
];

export function sanitizeAmountSuggestionSettings(raw: unknown): AmountSuggestionSettings {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const settings = { ...DEFAULT_AMOUNT_SUGGESTION_SETTINGS };
  if (typeof input.useInApp === "boolean") settings.useInApp = input.useInApp;
  for (const field of AMOUNT_SUGGESTION_FIELDS) {
    const value = Number(input[field.key]);
    if (Number.isFinite(value)) settings[field.key] = Math.min(field.max, Math.max(field.min, value));
  }
  return settings;
}

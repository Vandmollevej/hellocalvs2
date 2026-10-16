// Stemmeguiden på Kropsmål (brugerkrav 2026-10-14): en mikrofon øverst, og en
// stemme, der beder om ét mål ad gangen, forklarer hvor man måler, siger tallet
// tilbage og går videre til næste mål. Guiden kan KUN udfylde kropsmål-felterne
// — den forstår tal og fem kommandoer (spring over, tilbage, gentag, stop), og
// intet andet. Ren logik her (tale ind/ud ligger i siden), så web og native
// (native/.../profile/BodyMeasurementVoice.kt) følger samme regler.

export type VoiceCommand =
  | { kind: "value"; value: number }
  | { kind: "skip" }
  | { kind: "back" }
  | { kind: "repeat" }
  | { kind: "stop" }
  | { kind: "unknown" };

// Kommandoerne på appens sprog. Hele ord, så "næste" ikke rammer "næsten".
const COMMANDS: Record<Exclude<VoiceCommand["kind"], "value" | "unknown">, string[]> = {
  stop: [
    "stop", "stoppe", "afslut", "slut", "færdig", "luk", "annuller",
    "finish", "done", "quit", "cancel", "end",
    "stopp", "avsluta", "klar", "avslutt", "ferdig",
    "beenden", "fertig", "abbrechen", "arrête", "arrêter", "terminé", "fini", "klaar", "einde",
  ],
  skip: [
    "spring over", "spring", "næste", "videre", "ved ikke", "skip", "next", "pass",
    "hoppa över", "hoppa", "nästa", "hopp over", "neste", "vet ikke", "vet inte",
    "überspringen", "weiter", "nächste", "passer", "suivant", "overslaan", "volgende",
  ],
  back: [
    "tilbage", "forrige", "back", "previous", "go back", "tillbaka", "föregående",
    "zurück", "retour", "précédent", "terug", "vorige",
  ],
  repeat: [
    "gentag", "igen", "hvad", "hvordan", "repeat", "again", "what", "how",
    "upprepa", "gjenta", "hva", "wiederholen", "nochmal", "wie", "répète", "répéter",
    "comment", "herhaal", "opnieuw", "hoe",
  ],
};

// Talord for de sprog, hvor talegenkendelsen af og til skriver tallet med
// bogstaver. Danske sammensatte tal ("toogfirs") deles ved "og" nedenfor.
const UNITS: Record<string, number> = {
  nul: 0, zero: 0, en: 1, et: 1, one: 1, to: 2, two: 2, tre: 3, three: 3, fire: 4, four: 4,
  fem: 5, five: 5, seks: 6, six: 6, syv: 7, seven: 7, otte: 8, eight: 8, ni: 9, nine: 9,
  ti: 10, ten: 10, elleve: 11, eleven: 11, tolv: 12, twelve: 12, tretten: 13, thirteen: 13,
  fjorten: 14, fourteen: 14, femten: 15, fifteen: 15, seksten: 16, sixteen: 16,
  sytten: 17, seventeen: 17, atten: 18, eighteen: 18, nitten: 19, nineteen: 19,
};
const TENS: Record<string, number> = {
  tyve: 20, twenty: 20, tredive: 30, thirty: 30, fyrre: 40, forty: 40, halvtreds: 50, fifty: 50,
  tres: 60, sixty: 60, halvfjerds: 70, seventy: 70, firs: 80, eighty: 80, halvfems: 90, ninety: 90,
};
const HUNDRED = new Set(["hundrede", "hundred"]);
const DECIMAL_WORDS = new Set(["komma", "punkt", "point", "comma", "dot", "koma", "virgule", "punt"]);
const HALF_PATTERNS = [/\bog en halv\b/, /\bog et halvt\b/, /\band a half\b/, /\bhalvanden\b/];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[!?;:"'()]/g, " ")
    // Tusindtals-/talgrupper som "82 . 5" → "82.5"; sætningspunktum fjernes.
    .replace(/(\d)\s*([.,])\s*(\d)/g, "$1$2$3")
    .replace(/[.,](\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(text);
}

/** "toogfirs" → "to og firs" (danske sammensatte tal). */
function splitDanishCompounds(text: string): string {
  const units = "en|et|to|tre|fire|fem|seks|syv|otte|ni";
  const tens = "tyve|tredive|fyrre|halvtreds|tres|halvfjerds|firs|halvfems";
  return text.replace(new RegExp(`\\b(${units})og(${tens})\\b`, "g"), "$1 og $2");
}

/** Et tal skrevet med ord (højst 999), eller null. */
function wordsToNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let seen = false;
  for (const word of words) {
    if (word === "og" || word === "and" || word === "-") continue;
    if (word in UNITS) {
      current += UNITS[word];
      seen = true;
    } else if (word in TENS) {
      current += TENS[word];
      seen = true;
    } else if (HUNDRED.has(word)) {
      total += (current || 1) * 100;
      current = 0;
      seen = true;
    } else if (/^\d+$/.test(word) && !seen) {
      current += Number(word);
      seen = true;
    } else {
      return null;
    }
  }
  return seen ? total + current : null;
}

/** Tallet i det, der blev sagt (cm eller tommer), eller null. */
export function parseSpokenNumber(raw: string): number | null {
  let text = splitDanishCompounds(normalize(raw));
  const half = HALF_PATTERNS.some((pattern) => pattern.test(text)) ? 0.5 : 0;
  for (const pattern of HALF_PATTERNS) text = text.replace(pattern, " ");
  text = text.replace(/[-–]/g, " ").replace(/\s+/g, " ").trim();
  // Enheder og fyldord fjernes; tallet står så tilbage.
  const words = text
    .split(" ")
    .filter((word) => word && !/^(cm|centimeter|centimetre|centimeters|centimetres|tommer|tomme|inch|inches|in|zoll|pouces|duim|det|er|it|is|its|it's|jeg|har|i|målte|measured|ca|cirka|about|omkring|lige|præcis|exactly)$/.test(word));

  const decimalAt = words.findIndex((word) => DECIMAL_WORDS.has(word));
  if (decimalAt > 0) {
    const whole = wordsToNumber(words.slice(0, decimalAt));
    const fractionWords = words.slice(decimalAt + 1);
    const fraction = fractionWords.length === 1 && /^\d+$/.test(fractionWords[0])
      ? Number(`0.${fractionWords[0]}`)
      : (() => {
          const value = wordsToNumber(fractionWords);
          return value == null ? null : Number(`0.${value}`);
        })();
    if (whole != null && fraction != null) return whole + fraction;
  }

  // Ét tal med cifre ("82,5", "82.5", "82").
  const digitWords = words.filter((word) => /^\d+([.,]\d+)?$/.test(word));
  if (digitWords.length === 1 && words.length === 1) {
    return Number(digitWords[0].replace(",", ".")) + half;
  }
  if (digitWords.length === 1) {
    const rest = words.filter((word) => word !== digitWords[0]);
    // Cifre blandet med ukendte ord ("82 ... øh") — cifrene vinder.
    if (wordsToNumber(rest) == null) return Number(digitWords[0].replace(",", ".")) + half;
  }

  const value = wordsToNumber(words);
  return value == null ? null : value + half;
}

/** Hvad brugeren mente: et tal eller en af de fem kommandoer. */
export function interpretMeasurementSpeech(raw: string | null | undefined): VoiceCommand {
  const text = normalize(raw ?? "");
  if (!text) return { kind: "unknown" };
  const value = parseSpokenNumber(text);
  if (value != null) return { kind: "value", value: Math.round(value * 10) / 10 };
  for (const kind of ["stop", "skip", "back", "repeat"] as const) {
    if (COMMANDS[kind].some((phrase) => hasPhrase(text, phrase))) return { kind };
  }
  return { kind: "unknown" };
}

/** Et kropsmål på 5–250 cm (2–100 tommer) — alt andet er hørt forkert. */
export function isPlausibleMeasurement(value: number, unit: "cm" | "in"): boolean {
  return unit === "in" ? value >= 2 && value <= 100 : value >= 5 && value <= 250;
}

// --- Selve samtalen ---------------------------------------------------------

/** En sætning, guiden siger: en i18n-nøgle under bodyMeasurements.voice + parametre. */
export type VoiceLine = { key: string; field?: string; value?: number };

export type GuideState = {
  /** De synlige mål i sidens rækkefølge. */
  fields: readonly string[];
  index: number;
  /** Gange i træk uden at høre noget brugbart. */
  misses: number;
};

export type GuideStep = {
  state: GuideState;
  /** Mål, der skal gemmes nu (i den valgte enhed, som tastet). */
  save?: { field: string; value: number };
  say: VoiceLine[];
  /** Guiden er slut (alle mål, stop eller for mange forsøg). */
  done: boolean;
};

/** Hvor guiden starter: første mål uden dagens tal, ellers det første. */
export function firstGuideIndex(fields: readonly string[], filled: (field: string) => boolean): number {
  const index = fields.findIndex((field) => !filled(field));
  return index < 0 ? 0 : index;
}

function ask(field: string): VoiceLine[] {
  return [{ key: "ask", field }, { key: `how.${field}` }];
}

export function startGuide(fields: readonly string[], index: number): GuideStep {
  const state = { fields, index, misses: 0 };
  if (fields.length === 0) return { state, say: [{ key: "noFields" }], done: true };
  return { state, say: [{ key: "intro" }, ...ask(fields[index])], done: false };
}

/** Næste skridt efter det, brugeren sagde (null = intet hørt). */
export function guideStep(state: GuideState, heard: string | null, unit: "cm" | "in"): GuideStep {
  const field = state.fields[state.index];
  const command = interpretMeasurementSpeech(heard);

  if (command.kind === "unknown") {
    const misses = state.misses + 1;
    // Tre gange uden noget brugbart: stop, så mikrofonen ikke lytter i det uendelige.
    if (misses >= 3) return { state: { ...state, misses }, say: [{ key: "giveUp" }], done: true };
    return {
      state: { ...state, misses },
      say: [{ key: heard?.trim() ? "notUnderstood" : "notHeard", field }],
      done: false,
    };
  }

  const reset = { ...state, misses: 0 };
  switch (command.kind) {
    case "stop":
      return { state: reset, say: [{ key: "stopped" }], done: true };
    case "repeat":
      return { state: reset, say: ask(field), done: false };
    case "back": {
      const index = Math.max(0, state.index - 1);
      return { state: { ...reset, index }, say: ask(state.fields[index]), done: false };
    }
    case "skip": {
      const index = state.index + 1;
      if (index >= state.fields.length) return { state: { ...reset, index }, say: [{ key: "skipped" }, { key: "done" }], done: true };
      return { state: { ...reset, index }, say: [{ key: "skipped" }, ...ask(state.fields[index])], done: false };
    }
    case "value": {
      if (!isPlausibleMeasurement(command.value, unit)) {
        return { state: reset, say: [{ key: "outOfRange", value: command.value, field }], done: false };
      }
      const save = { field, value: command.value };
      const index = state.index + 1;
      const recorded: VoiceLine = { key: "recorded", value: command.value };
      if (index >= state.fields.length) return { state: { ...reset, index }, save, say: [recorded, { key: "done" }], done: true };
      return { state: { ...reset, index }, save, say: [recorded, { key: "next", field: state.fields[index] }, { key: `how.${state.fields[index]}` }], done: false };
    }
  }
}

/** BCP-47-tag til tale ind og ud på appens sprog. */
export function voiceLanguageTag(locale: string): string {
  const tags: Record<string, string> = {
    da: "da-DK", en: "en-GB", sv: "sv-SE", no: "nb-NO", de: "de-DE", fr: "fr-FR", nl: "nl-NL",
  };
  return tags[locale] ?? "da-DK";
}

/** Tallet, som stemmen siger det: "82,5" på dansk, "82.5" på engelsk. */
export function formatSpokenValue(value: number, locale: string): string {
  return new Intl.NumberFormat(voiceLanguageTag(locale), { maximumFractionDigits: 1 }).format(value);
}

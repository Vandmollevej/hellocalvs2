// Screeninger (docs/DECISIONS.md 2026-10-09): egne målinger under Profil.
// Fælles typer, skalaer og validering for web, API og (spejlet) native.

export const SCREENING_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "MANUAL"] as const;
export const SCREENING_SCALES = ["FIVE", "TEN", "PERCENT"] as const;
export const SCREENING_INPUT_TYPES = ["BUTTONS", "SLIDER", "INPUT", "STEPPER"] as const;

export type ScreeningFrequency = (typeof SCREENING_FREQUENCIES)[number];
export type ScreeningScale = (typeof SCREENING_SCALES)[number];
export type ScreeningInputType = (typeof SCREENING_INPUT_TYPES)[number];

export type ScreeningQuestion = { id: string; text: string };

export type ScreeningDto = {
  id: string;
  presetKey: string | null;
  name: string;
  purpose: string;
  frequency: ScreeningFrequency;
  questions: ScreeningQuestion[];
  notificationsEnabled: boolean;
  notificationTime: string | null;
  scale: ScreeningScale;
  inputType: ScreeningInputType;
  notesEnabled: boolean;
  minLabel: string;
  maxLabel: string;
  showInCalendar: boolean;
  active: boolean;
  sortOrder: number;
};

export type ScreeningEntryDto = {
  id: string;
  screeningId: string;
  date: string; // YYYY-MM-DD
  answers: Record<string, number>;
  value: number;
  note: string | null;
};

export const SCREENING_MAX_QUESTIONS = 10;

/** Laveste og højeste værdi pr. skala (1–5, 1–10, 0–100 %). */
export function scaleRange(scale: ScreeningScale): { min: number; max: number; step: number } {
  if (scale === "FIVE") return { min: 1, max: 5, step: 1 };
  if (scale === "TEN") return { min: 1, max: 10, step: 1 };
  return { min: 0, max: 100, step: 5 };
}

export function formatScreeningValue(value: number, scale: ScreeningScale): string {
  const rounded = Math.round(value * 10) / 10;
  return scale === "PERCENT" ? `${rounded} %` : String(rounded);
}

export function isScreeningFrequency(value: unknown): value is ScreeningFrequency {
  return typeof value === "string" && (SCREENING_FREQUENCIES as readonly string[]).includes(value);
}
export function isScreeningScale(value: unknown): value is ScreeningScale {
  return typeof value === "string" && (SCREENING_SCALES as readonly string[]).includes(value);
}
export function isScreeningInputType(value: unknown): value is ScreeningInputType {
  return typeof value === "string" && (SCREENING_INPUT_TYPES as readonly string[]).includes(value);
}

/** Gennemsnit af svarene (kun gyldige tal inden for skalaen). */
export function averageAnswer(answers: Record<string, number>): number {
  const values = Object.values(answers).filter((v) => Number.isFinite(v));
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

/** Renser spørgsmål fra klienten: tekst skal være udfyldt, id'er unikke. */
export function cleanQuestions(input: unknown): ScreeningQuestion[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: ScreeningQuestion[] = [];
  for (const item of input.slice(0, SCREENING_MAX_QUESTIONS)) {
    const raw = item as Partial<ScreeningQuestion> | null;
    const text = typeof raw?.text === "string" ? raw.text.trim().slice(0, 200) : "";
    if (!text) continue;
    let id = typeof raw?.id === "string" && raw.id ? raw.id.slice(0, 40) : `q${out.length + 1}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    out.push({ id, text });
  }
  return out;
}

/** Renser svar: kun kendte spørgsmål, afrundet og holdt inden for skalaen. */
export function cleanAnswers(
  input: unknown,
  questions: ScreeningQuestion[],
  scale: ScreeningScale,
): Record<string, number> {
  const { min, max } = scaleRange(scale);
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const question of questions) {
    const value = Number(raw[question.id]);
    if (!Number.isFinite(value)) continue;
    out[question.id] = Math.min(max, Math.max(min, Math.round(value)));
  }
  return out;
}

/** Forudlavede screeninger; tekster ligger i i18n under screenings.presets.<key>. */
export const SCREENING_PRESETS = [
  { key: "migraine", scale: "TEN", inputType: "SLIDER", showInCalendar: false },
  { key: "stomachPain", scale: "TEN", inputType: "SLIDER", showInCalendar: false },
  { key: "mood", scale: "FIVE", inputType: "BUTTONS", showInCalendar: false },
] as const;
export type ScreeningPresetKey = (typeof SCREENING_PRESETS)[number]["key"];

/** Graf-perioder (dage) i dropdown på screeningsiden. */
export const SCREENING_PERIODS = ["7", "30", "90", "365"] as const;
export type ScreeningPeriodKey = (typeof SCREENING_PERIODS)[number];

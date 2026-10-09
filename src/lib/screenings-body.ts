import {
  cleanQuestions,
  isScreeningFrequency,
  isScreeningInputType,
  isScreeningScale,
} from "@/lib/screenings";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type Data = {
  name?: string;
  purpose?: string;
  frequency?: string;
  questions?: { id: string; text: string }[];
  notificationsEnabled?: boolean;
  notificationTime?: string | null;
  scale?: string;
  inputType?: string;
  notesEnabled?: boolean;
  minLabel?: string;
  maxLabel?: string;
  showInCalendar?: boolean;
  active?: boolean;
};

/** Validerer body til POST (alle felter) og PATCH (kun de medsendte). */
export function parseScreeningBody(
  body: unknown,
  requireAll: boolean,
): { ok: true; data: Data } | { ok: false; message: string } {
  const b = (body && typeof body === "object" ? body : null) as Record<string, unknown> | null;
  if (!b) return { ok: false, message: "Ugyldig forespørgsel" };
  const data: Data = {};

  if (b.name !== undefined || requireAll) {
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 60) : "";
    if (!name) return { ok: false, message: "Navn er påkrævet" };
    data.name = name;
  }
  if (b.purpose !== undefined) data.purpose = String(b.purpose).trim().slice(0, 300);
  if (b.frequency !== undefined || requireAll) {
    const frequency = b.frequency ?? "DAILY";
    if (!isScreeningFrequency(frequency)) return { ok: false, message: "Ugyldig frekvens" };
    data.frequency = frequency;
  }
  if (b.questions !== undefined || requireAll) {
    const questions = cleanQuestions(b.questions);
    if (questions.length === 0) return { ok: false, message: "Mindst ét spørgsmål er påkrævet" };
    data.questions = questions;
  }
  if (b.scale !== undefined || requireAll) {
    const scale = b.scale ?? "TEN";
    if (!isScreeningScale(scale)) return { ok: false, message: "Ugyldig skala" };
    data.scale = scale;
  }
  if (b.inputType !== undefined || requireAll) {
    const inputType = b.inputType ?? "SLIDER";
    if (!isScreeningInputType(inputType)) return { ok: false, message: "Ugyldig inputtype" };
    data.inputType = inputType;
  }
  for (const key of ["notificationsEnabled", "notesEnabled", "showInCalendar", "active"] as const) {
    if (b[key] !== undefined) data[key] = b[key] === true;
  }
  if (b.notificationTime !== undefined) {
    if (b.notificationTime === null || b.notificationTime === "") data.notificationTime = null;
    else if (typeof b.notificationTime === "string" && TIME_RE.test(b.notificationTime)) {
      data.notificationTime = b.notificationTime;
    } else return { ok: false, message: "Ugyldigt tidspunkt" };
  }
  if (b.minLabel !== undefined) data.minLabel = String(b.minLabel).trim().slice(0, 30);
  if (b.maxLabel !== undefined) data.maxLabel = String(b.maxLabel).trim().slice(0, 30);
  return { ok: true, data };
}

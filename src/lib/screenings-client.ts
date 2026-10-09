import type { ScreeningDto, ScreeningEntryDto } from "@/lib/screenings";
import { SCREENING_PRESETS } from "@/lib/screenings";

// Klientens kald til /api/screenings (docs/DECISIONS.md 2026-10-09).

type Translate = (key: string) => string;

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Henter brugerens screeninger; første gang oprettes migræne, mavesmerter og humør på brugerens sprog. */
export async function fetchScreenings(t: Translate): Promise<ScreeningDto[]> {
  let response = await fetch("/api/screenings");
  if (!response.ok) throw new Error("failed");
  let data = (await response.json()) as { seeded: boolean; screenings: ScreeningDto[] };
  if (!data.seeded) {
    const texts = Object.fromEntries(
      SCREENING_PRESETS.map((preset) => [
        preset.key,
        {
          name: t(`screenings.presets.${preset.key}.name`),
          purpose: t(`screenings.presets.${preset.key}.purpose`),
          question: t(`screenings.presets.${preset.key}.question`),
          min: t(`screenings.presets.${preset.key}.min`),
          max: t(`screenings.presets.${preset.key}.max`),
        },
      ]),
    );
    await fetch("/api/screenings/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });
    response = await fetch("/api/screenings");
    if (!response.ok) throw new Error("failed");
    data = (await response.json()) as { seeded: boolean; screenings: ScreeningDto[] };
  }
  return data.screenings;
}

export async function fetchEntriesInRange(from: string, to: string, calendarOnly = false): Promise<ScreeningEntryDto[]> {
  const response = await fetch(`/api/screenings/entries?from=${from}&to=${to}${calendarOnly ? "&calendar=1" : ""}`);
  if (!response.ok) throw new Error("failed");
  return ((await response.json()) as { entries: ScreeningEntryDto[] }).entries;
}

export async function saveScreeningEntry(
  screeningId: string,
  body: { date: string; answers: Record<string, number>; note: string | null },
): Promise<boolean> {
  const response = await fetch(`/api/screenings/${screeningId}/entries`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.ok;
}

export async function patchScreening(id: string, body: Partial<ScreeningDto>): Promise<boolean> {
  const response = await fetch(`/api/screenings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.ok;
}

export async function deleteScreening(id: string): Promise<boolean> {
  return (await fetch(`/api/screenings/${id}`, { method: "DELETE" })).ok;
}

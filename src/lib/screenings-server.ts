import { prisma } from "@/lib/prisma";
import {
  SCREENING_PRESETS,
  cleanQuestions,
  isScreeningFrequency,
  isScreeningInputType,
  isScreeningScale,
  type ScreeningDto,
  type ScreeningEntryDto,
} from "@/lib/screenings";
import type { Screening, ScreeningEntry } from "@prisma/client";

export function toScreeningDto(row: Screening): ScreeningDto {
  return {
    id: row.id,
    presetKey: row.presetKey,
    name: row.name,
    purpose: row.purpose,
    frequency: isScreeningFrequency(row.frequency) ? row.frequency : "DAILY",
    questions: cleanQuestions(row.questions),
    notificationsEnabled: row.notificationsEnabled,
    notificationTime: row.notificationTime,
    scale: isScreeningScale(row.scale) ? row.scale : "TEN",
    inputType: isScreeningInputType(row.inputType) ? row.inputType : "SLIDER",
    notesEnabled: row.notesEnabled,
    minLabel: row.minLabel,
    maxLabel: row.maxLabel,
    showInCalendar: row.showInCalendar,
    active: row.active,
    sortOrder: row.sortOrder,
  };
}

export function toEntryDto(row: ScreeningEntry): ScreeningEntryDto {
  return {
    id: row.id,
    screeningId: row.screeningId,
    date: row.date.toISOString().slice(0, 10),
    answers: (row.answers ?? {}) as Record<string, number>,
    value: row.value,
    note: row.note,
  };
}

/**
 * Opretter migræne, mavesmerter og humør første gang en bruger åbner
 * screeninger. Navne og spørgsmål kommer fra klientens sprog (`texts`), så
 * de står på brugerens eget sprog; sletter brugeren dem, oprettes de ikke igen.
 */
export async function seedPresetScreenings(
  userId: string,
  texts: Record<string, { name: string; purpose: string; question: string; min: string; max: string }>,
) {
  const claimed = await prisma.user.updateMany({
    where: { id: userId, screeningsSeeded: false },
    data: { screeningsSeeded: true },
  });
  if (claimed.count === 0) return;
  await prisma.screening.createMany({
    data: SCREENING_PRESETS.map((preset, index) => {
      const text = texts[preset.key];
      return {
        userId,
        presetKey: preset.key,
        name: text?.name ?? preset.key,
        purpose: text?.purpose ?? "",
        frequency: "DAILY",
        questions: [{ id: "q1", text: text?.question ?? text?.name ?? preset.key }],
        scale: preset.scale,
        inputType: preset.inputType,
        minLabel: text?.min ?? "",
        maxLabel: text?.max ?? "",
        showInCalendar: preset.showInCalendar,
        active: true,
        sortOrder: index,
      };
    }),
  });
}

"use client";

import { IconX } from "@tabler/icons-react";
import { AccordionCard } from "@/components/hf/AccordionCard";
import { getSportMeta } from "@/lib/sport-icons";
import type { ActivityOption } from "@/lib/activity-types";
import { stepDuration } from "@/lib/activity-duration";
import { useTranslation } from "@/i18n/LocaleProvider";

export type SessionEntry = { id: number; option: ActivityOption; minutes: number };

// Øvelserne i et træningspas (Tilføj → Aktivitet → Opret træningspas): hver
// række har sin egen varighed (±5 min) og kan fjernes.
export function TrainingSessionCard({
  entries,
  onChange,
}: {
  entries: SessionEntry[];
  onChange: (entries: SessionEntry[]) => void;
}) {
  const { t } = useTranslation();
  if (entries.length === 0) {
    return (
      <AccordionCard>
        <p className="hf-type-caption px-4 py-3">{t("activity.session.empty")}</p>
      </AccordionCard>
    );
  }
  const update = (id: number, minutes: number) =>
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, minutes } : entry)));
  return (
    <AccordionCard>
      {entries.map((entry, index) => {
        const Icon = getSportMeta(entry.option.key).icon;
        return (
          <div
            key={entry.id}
            className={`flex h-12 w-full items-center gap-3 pl-4 ${index < entries.length - 1 ? "border-b border-hf-tan-dark" : ""}`}
          >
            <Icon size={20} className="shrink-0 text-hf-black" />
            <span className="hf-type-body min-w-0 flex-1 truncate text-hf-black">{entry.option.label}</span>
            <button
              type="button"
              className="h-10 w-8 text-hf-black hf-type-body-lg"
              aria-label="−5 min"
              onClick={() => update(entry.id, stepDuration(entry.minutes, -1))}
            >
              −
            </button>
            <span className="hf-type-body hf-type-strong w-14 text-center text-hf-black">
              {entry.minutes} {t("activity.minutesShort")}
            </span>
            <button
              type="button"
              className="h-10 w-8 text-hf-black hf-type-body-lg"
              aria-label="+5 min"
              onClick={() => update(entry.id, stepDuration(entry.minutes, 1))}
            >
              +
            </button>
            <button
              type="button"
              className="flex h-12 items-center pl-1 pr-4 text-hf-black"
              aria-label={t("activity.session.remove", { name: entry.option.label })}
              onClick={() => onChange(entries.filter((item) => item.id !== entry.id))}
            >
              <IconX size={20} />
            </button>
          </div>
        );
      })}
    </AccordionCard>
  );
}

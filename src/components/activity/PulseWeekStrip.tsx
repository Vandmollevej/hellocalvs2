"use client";

import { useMemo } from "react";
import { IconCheck, IconQuestionMark } from "@tabler/icons-react";
import { intlLocale } from "@/i18n";
import { useTranslation } from "@/i18n/LocaleProvider";
import { buildWeek, type WeekActivity } from "@/lib/pulse-week";

// Ugen med udsvinget, mandag–søndag, vandret med datoer (docs/DECISIONS.md
// 2026-10-04). Dage med registreret sport er krydset af med klokkeslæt;
// udsvinget, brugeren spørges om, står som "?" med sit tidspunkt. Syv lige
// brede felter, så strimlen passer lige godt på telefon og desktop.
const MAX_ENTRIES = 3;

export function PulseWeekStrip({ activities, askedAt }: { activities: WeekActivity[]; askedAt: string }) {
  const { t, locale } = useTranslation();
  const tag = intlLocale(locale);
  const days = useMemo(() => {
    const asked = new Date(askedAt);
    return buildWeek(asked, activities, asked);
  }, [activities, askedAt]);

  const weekday = new Intl.DateTimeFormat(tag, { weekday: "short" });
  const longDate = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long" });
  const shortDate = new Intl.DateTimeFormat(tag, { day: "numeric", month: "numeric" });
  const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="flex flex-col gap-2" aria-label={t("activity.weekTitle")}>
      <h2 className="hf-type-small hf-type-strong text-hf-black">{t("activity.weekTitle")}</h2>
      <ol className="m-0 grid list-none grid-cols-7 gap-1 p-0">
        {days.map((day) => {
          const visible = day.entries.slice(0, MAX_ENTRIES);
          const hidden = day.entries.length - visible.length;
          const label = [
            longDate.format(day.date),
            ...day.entries.map((entry) =>
              t(entry.kind === "activity" ? "activity.weekDayDone" : "activity.weekDayAsked", { time: time.format(entry.at) }),
            ),
          ].join(", ");
          return (
            <li
              key={day.key}
              aria-label={label}
              aria-current={day.isToday ? "date" : undefined}
              className={`rounded-card flex min-w-0 flex-col items-center gap-1 px-0.5 py-2 ${
                day.isAskedDay ? "bg-hf-tan" : ""
              } ${day.isFuture ? "opacity-50" : ""}`}
            >
              <span className="hf-type-caption w-full truncate text-center uppercase text-text-secondary">
                {weekday.format(day.date).replace(/\.$/, "")}
              </span>
              <span
                className={`hf-type-caption w-full truncate text-center ${
                  day.isToday ? "hf-type-strong text-hf-green-dark" : "text-hf-black"
                }`}
              >
                {shortDate.format(day.date)}
              </span>
              {visible.length === 0 && !day.isFuture && (
                <span className="mt-1 size-1.5 rounded-full bg-hf-tan-dark" aria-hidden="true" />
              )}
              {visible.map((entry, index) => (
                <span key={`${entry.kind}-${index}`} className="flex flex-col items-center gap-0.5" aria-hidden="true">
                  {entry.kind === "activity" ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-hf-green-dark text-hf-white">
                      <IconCheck size={14} stroke={3} />
                    </span>
                  ) : (
                    <span className="flex size-6 items-center justify-center rounded-full border-2 border-dashed border-hf-green-dark text-hf-green-dark">
                      <IconQuestionMark size={14} stroke={3} />
                    </span>
                  )}
                  <span className={`hf-type-caption ${entry.kind === "asked" ? "hf-type-strong text-hf-black" : "text-text-secondary"}`}>
                    {time.format(entry.at)}
                  </span>
                </span>
              ))}
              {hidden > 0 && (
                <span className="hf-type-caption text-text-secondary" aria-hidden="true">
                  +{hidden}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="hf-type-caption flex flex-wrap items-center gap-x-4 gap-y-1 text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <span className="flex size-4 items-center justify-center rounded-full bg-hf-green-dark text-hf-white">
            <IconCheck size={10} stroke={3} />
          </span>
          {t("activity.weekLegendDone")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="flex size-4 items-center justify-center rounded-full border border-dashed border-hf-green-dark text-hf-green-dark">
            <IconQuestionMark size={10} stroke={3} />
          </span>
          {t("activity.weekLegendAsked")}
        </span>
      </p>
    </section>
  );
}

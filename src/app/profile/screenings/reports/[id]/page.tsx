"use client";

import { use, useEffect, useMemo, useState } from "react";
import { IconArrowDown, IconArrowUp, IconChevronDown, IconNote } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { FoodRow } from "@/components/FoodRow";
import { HfLoader } from "@/components/hf/HfLoader";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatScreeningValue, type ScreeningDto, type ScreeningEntryDto } from "@/lib/screenings";

type SortKey = "date" | "value";

// Rapport for én screening: målingerne i datorækkefølge, kan sorteres efter
// dato eller værdi (nummer). Dage med note har et noteikon. Rækkerne bruger
// FoodRow som madvarerne.
export default function ScreeningReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const [screening, setScreening] = useState<ScreeningDto | null>(null);
  const [entries, setEntries] = useState<ScreeningEntryDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [descending, setDescending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/screenings/${id}/entries`)
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { screening: ScreeningDto; entries: ScreeningEntryDto[] };
      })
      .then((data) => {
        if (cancelled) return;
        setScreening(data.screening);
        setEntries(data.entries);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const sorted = useMemo(() => {
    const list = [...(entries ?? [])];
    list.sort((a, b) => {
      const diff = sortKey === "date" ? a.date.localeCompare(b.date) : a.value - b.value || a.date.localeCompare(b.date);
      return descending ? -diff : diff;
    });
    return list;
  }, [entries, sortKey, descending]);

  const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <HfScreen title={screening?.name ?? t("screenings.reportsTitle")}>
      <div className="hf-page">
        {!entries && !failed && (
          <div className="flex justify-center py-6">
            <HfLoader />
          </div>
        )}
        {failed && <p className="hf-type-body text-text-secondary">{t("screenings.loadError")}</p>}
        {screening && entries && entries.length === 0 && (
          <p className="hf-type-body text-text-secondary">{t("screenings.noEntries")}</p>
        )}
        {screening && entries && entries.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  aria-label={t("screenings.sortAria")}
                  className="hf-field hf-type-body w-full appearance-none rounded-xl border border-hf-tan-dark bg-hf-white pl-3 pr-9 text-hf-black"
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                >
                  <option value="date">{t("screenings.sortDate")}</option>
                  <option value="value">{t("screenings.sortValue")}</option>
                </select>
                <IconChevronDown
                  size={14}
                  stroke={2.5}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-hf-black"
                />
              </div>
              <button
                type="button"
                aria-label={t("screenings.sortAria")}
                onClick={() => setDescending((value) => !value)}
                className="flex size-12 items-center justify-center rounded-xl border border-hf-tan-dark bg-hf-white text-hf-black"
              >
                {descending ? <IconArrowDown size={20} /> : <IconArrowUp size={20} />}
              </button>
            </div>
            <div className="hf-card !py-0">
              {sorted.map((entry, index) => (
                <div key={entry.id} className={index < sorted.length - 1 ? "border-b border-hf-tan-dark" : ""}>
                  <FoodRow
                    thumbnail={
                      <span className="hf-type-body hf-type-strong text-hf-black">
                        {Math.round(entry.value * 10) / 10}
                      </span>
                    }
                    title={dateFormat.format(new Date(entry.date))}
                    subtitle={
                      <p className="hf-type-small text-text-secondary">
                        {entry.note ? entry.note : formatScreeningValue(entry.value, screening.scale)}
                      </p>
                    }
                    right={
                      entry.note ? (
                        <IconNote size={20} aria-label={t("screenings.hasNote")} className="text-hf-black" />
                      ) : undefined
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </HfScreen>
  );
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { IconHeartFilled } from "@tabler/icons-react";
import { PulseEventSheet } from "@/components/activity/PulseEventSheet";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { PulseEvent } from "@/lib/pulse-candidates";

// Kalenderens røde hjerter (docs/DECISIONS.md 2026-10-09): dage med højt
// puls de seneste 7 dage får et rødt hjerte ved siden af vægten (eller i
// dens sted, hvis man ikke har vejet sig). Tryk åbner pulsarket med pile til
// de øvrige tilfælde.

type Value = {
  eventsFor: (date: Date) => PulseEvent[];
  open: (event: PulseEvent) => void;
};

const PulseEventsContext = createContext<Value>({ eventsFor: () => [], open: () => {} });

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function PulseEventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch("/api/activities/spike/events")
      .then((res) => (res.ok ? (res.json() as Promise<{ events?: PulseEvent[] }>) : { events: [] }))
      .then((data) => setEvents(data.events ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  const value = useMemo<Value>(() => {
    const byDay = new Map<string, PulseEvent[]>();
    for (const event of events) {
      const key = dateKey(new Date(event.startedAt));
      byDay.set(key, [...(byDay.get(key) ?? []), event]);
    }
    return {
      eventsFor: (date) => byDay.get(dateKey(date)) ?? [],
      open: (event) => setOpenIndex(events.findIndex((item) => item.startedAt === event.startedAt)),
    };
  }, [events]);

  return (
    <PulseEventsContext.Provider value={value}>
      {children}
      {openIndex !== null && openIndex >= 0 && (
        <PulseEventSheet
          events={events}
          initialIndex={openIndex}
          mode="calendar"
          onChanged={load}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </PulseEventsContext.Provider>
  );
}

/** Rødt hjerte for en dag med højt puls; tryk åbner pulsarket uden at åbne selve dagen. */
export function PulseHeartMark({ date, size = 18, className = "" }: { date: Date; size?: number; className?: string }) {
  const { t } = useTranslation();
  const { eventsFor, open } = useContext(PulseEventsContext);
  const events = eventsFor(date);
  if (events.length === 0) return null;
  const unanswered = events.find((event) => event.status === "PENDING");
  const target = unanswered ?? events[events.length - 1];
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={t("activity.heartAria")}
      className={`inline-flex shrink-0 cursor-pointer items-center text-hf-red-dark ${className}`}
      onClick={(event) => {
        event.stopPropagation();
        open(target);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        open(target);
      }}
    >
      <IconHeartFilled size={size} aria-hidden="true" />
    </span>
  );
}

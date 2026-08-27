"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import {
  activeStatKeys,
  computeStatCards,
  addStatCardToLayout,
  DEFAULT_ACTIVE_STAT_KEYS,
  STAT_WINDOW_DAYS,
  type StatCardValue,
  type StatGridLayoutItem,
} from "@/lib/stat-cards";
import { groupByDay, withinLastDays, type RegistrationTotals } from "@/lib/daily-totals";

const DEFAULT_LAYOUT: StatGridLayoutItem[] = DEFAULT_ACTIVE_STAT_KEYS.map((key) => ({
  type: "stat" as const,
  key,
}));

// Grupperer de kendte statistik-kort (src/lib/stat-cards.ts) i faste kategorier.
// Kategorier uden nogen matchende kort i denne kodebase vises stadig, men med en
// besked om at der endnu ikke findes data — der opfindes ingen nye stat-typer her.
const CATEGORY_KEYS: { title: string; keys: string[] }[] = [
  { title: "Energi og makrofordeling", keys: ["calories", "protein", "carbs", "fat"] },
  { title: "Kulhydrattyper og fibre", keys: [] },
  { title: "Vitaminer", keys: [] },
  { title: "Mineraler", keys: [] },
  { title: "Aktivitet og øvrige data", keys: ["steps", "water", "burned", "daysLogged", "goalsMet"] },
];

export default function UbrugteStatCardsPage() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<RegistrationTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(() => activeStatKeys(DEFAULT_LAYOUT));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/registrations")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente registreringer");
        return (await response.json()) as { registrations: RegistrationTotals[] };
      })
      .then((data) => {
        if (!cancelled) setRegistrations(data.registrations);
      })
      .catch(() => {
        if (!cancelled) setRegistrations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allCards = useMemo(() => {
    const days = groupByDay(withinLastDays(registrations, STAT_WINDOW_DAYS));
    return computeStatCards({ days });
  }, [registrations]);

  const cardByKey = useMemo(() => new Map(allCards.map((c) => [c.key, c])), [allCards]);

  function addCard(key: string) {
    addStatCardToLayout(DEFAULT_LAYOUT, key);
    setActiveKeys((prev) => new Set(prev).add(key));
    router.back();
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Ubrugte statistik-kort" onBack={() => router.back()} />

      <div className="flex flex-col gap-5 p-4">
        <p className="text-xs text-hf-black opacity-60">
          Tryk på et kort for at tilføje det til din statistikside.
        </p>

        {CATEGORY_KEYS.map((category) => {
          const cards = category.keys
            .map((key) => cardByKey.get(key))
            .filter((c): c is StatCardValue => Boolean(c))
            .filter((c) => !activeKeys.has(c.key));

          return (
            <section key={category.title} className="flex flex-col gap-2">
              <p className="hf-heading text-xs font-bold uppercase tracking-wide text-hf-black opacity-60">
                {category.title}
              </p>

              {cards.length === 0 ? (
                <p className="rounded-2xl bg-hf-tan/60 p-3 text-xs text-hf-black opacity-50">
                  Ingen kort her endnu.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {cards.map((card) => {
                    const CardIcon = card.icon;
                    return (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() => addCard(card.key)}
                        className="rounded-2xl bg-hf-tan p-4 text-left active:opacity-80"
                      >
                        <p className="text-xs text-hf-black opacity-60">{card.label}</p>
                        <p className="hf-heading mt-1 flex items-center gap-1.5 text-xl text-hf-black">
                          <CardIcon size={17} stroke={2} />
                          {loading ? "—" : card.value}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

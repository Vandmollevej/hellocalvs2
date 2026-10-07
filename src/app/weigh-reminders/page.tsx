"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { REMINDER_HOURS } from "@/lib/weigh-reminders";

// Vejepåmindelser (docs/DECISIONS.md 2026-10-07): dagen vist som en tidslinje
// med én kontakt pr. 2. time; en push 5 minutter før de valgte tidspunkter.
export default function WeighRemindersPage() {
  const [enabled, setEnabled] = useState(false);
  const [hours, setHours] = useState<number[]>(REMINDER_HOURS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/weigh-reminders")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enabled: boolean; hours: number[] } | null) => {
        if (data) {
          setEnabled(data.enabled);
          if (data.hours.length) setHours(data.hours);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  function save(nextEnabled: boolean, nextHours: number[]) {
    setEnabled(nextEnabled);
    setHours(nextHours);
    void fetch("/api/weigh-reminders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled, hours: nextHours }),
    }).catch(() => undefined);
  }

  return (
    <HfScreen title="Vejepåmindelser">
      <div className="flex flex-col gap-4 p-4">
        <p className="hf-type-body text-text-secondary">
          Vej dig på samme tidspunkt og under samme forhold. Vælg de tidspunkter, hvor du vil have en påmindelse 5 minutter før.
        </p>
        <Toggle
          label="Påmind mig om at veje mig"
          description="Kræver, at notifikationer er slået til på din enhed."
          checked={enabled}
          disabled={!loaded}
          onChange={(value) => save(value, hours)}
        />
        <ol className="flex flex-col gap-2" aria-label="Dagens tidspunkter">
          {REMINDER_HOURS.map((hour) => {
            const on = hours.includes(hour);
            return (
              <li key={hour} className="hf-control-row flex items-center justify-between rounded-lg border border-hf-tan-dark bg-hf-white pl-4 pr-3">
                <span className="hf-type-body text-hf-black">
                  {String(hour).padStart(2, "0")}:00
                  <span className="ml-2 hf-type-small text-text-muted">påmindelse {String(hour - 1).padStart(2, "0")}:55</span>
                </span>
                <Toggle
                  ariaLabel={`Påmindelse kl. ${hour}`}
                  checked={on}
                  disabled={!enabled}
                  onChange={(value) => save(enabled, value ? [...hours, hour].sort((a, b) => a - b) : hours.filter((h) => h !== hour))}
                />
              </li>
            );
          })}
        </ol>
      </div>
    </HfScreen>
  );
}

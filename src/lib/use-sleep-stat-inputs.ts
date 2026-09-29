"use client";

import { useEffect, useState } from "react";
import type { IntegrationCardStatus } from "@/lib/integrations";
import type { SleepRegistration } from "@/lib/sleep-stats";
import type { ActivityTotals, HealthMetricTotals } from "@/lib/stat-cards";

// Data til søvnstatistikken (src/lib/sleep-stats.ts), ud over selve
// søvnvurderingerne, som hentes pr. periode.
export type SleepStatInputs = {
  loading: boolean;
  registrations: SleepRegistration[];
  activities: ActivityTotals[];
  metrics: HealthMetricTotals[];
  integrations: IntegrationCardStatus[];
};

async function getJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url);
    return response.ok ? ((await response.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useSleepStatInputs(): SleepStatInputs {
  const [inputs, setInputs] = useState<SleepStatInputs>({
    loading: true,
    registrations: [],
    activities: [],
    metrics: [],
    integrations: [],
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getJson("/api/registrations", { registrations: [] as SleepRegistration[] }),
      getJson("/api/activities", { activities: [] as ActivityTotals[] }),
      getJson("/api/health-metrics", { metrics: [] as HealthMetricTotals[] }),
      getJson("/api/integrations", { integrations: [] as IntegrationCardStatus[] }),
    ]).then(([r, a, m, i]) => {
      if (cancelled) return;
      setInputs({
        loading: false,
        registrations: r.registrations,
        activities: a.activities,
        metrics: m.metrics,
        integrations: i.integrations,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return inputs;
}

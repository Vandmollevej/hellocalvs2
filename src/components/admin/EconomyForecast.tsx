"use client";

import { useState } from "react";
import type { Forecast } from "@/lib/admin-economy";

const kr = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const pct = (n: number) => `${Math.round(n * 1000) / 10} %`;

// Næste måneds forventede indtjening. Starter med den statistiske udregning
// fra serveren; "Beregn med AI" lader OpenAI vurdere afmeldingsprocenterne.
export function EconomyForecast({ initial, basis }: { initial: Forecast; basis: string }) {
  const [forecast, setForecast] = useState(initial);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/economy/ai", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { forecast?: Forecast; explanation?: string; message?: string };
      if (!res.ok || !data.forecast) throw new Error(data.message ?? "AI-udregningen fejlede");
      setForecast(data.forecast);
      setExplanation(data.explanation ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI-udregningen fejlede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-hf-tan p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hf-type-strong text-hf-black">
          Næste måneds forventede indtjening: {kr.format(forecast.totalDkk)} kr.
        </p>
        <button type="button" onClick={run} disabled={loading} className="hf-control rounded-md bg-hf-fab px-3 text-hf-white disabled:opacity-60">
          {loading ? "Beregner …" : "Beregn med AI"}
        </button>
      </div>
      <p className="hf-type-small text-text-secondary">
        {forecast.windowLabel} · fornyelser efter forventet afmelding: måned {kr.format(forecast.monthly.amountDkk)} kr. ({pct(forecast.churn.monthly)}),
        3 mdr. {kr.format(forecast.quarterly.amountDkk)} kr. ({pct(forecast.churn.quarterly)}), år {kr.format(forecast.annual.amountDkk)} kr. (
        {pct(forecast.churn.annual)}).
      </p>
      <p className="hf-type-small text-text-muted">{explanation ?? basis}</p>
      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
    </div>
  );
}

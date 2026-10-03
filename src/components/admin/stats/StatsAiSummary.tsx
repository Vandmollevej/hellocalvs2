"use client";

import { useState } from "react";

// "Analysér med AI" på /admin/statistics: sender kun filteret; serveren
// beregner de aggregerede tal igen og beder OpenAI om en kort opsummering.
export function StatsAiSummary({ query }: { query: string }) {
  const [state, setState] = useState<{ loading: boolean; text: string | null; error: string | null }>({
    loading: false,
    text: null,
    error: null,
  });

  async function run() {
    setState({ loading: true, text: null, error: null });
    try {
      const res = await fetch(`/api/admin/statistics/ai-trends${query ? `?${query}` : ""}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { summary?: string; message?: string };
      if (!res.ok || !data.summary) throw new Error(data.message ?? "AI-analysen fejlede");
      setState({ loading: false, text: data.summary, error: null });
    } catch (error) {
      setState({ loading: false, text: null, error: error instanceof Error ? error.message : "AI-analysen fejlede" });
    }
  }

  return (
    <div className="hf-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hf-type-body hf-type-strong text-text-primary">AI-opsummering af brugsadfærd</p>
        <button
          type="button"
          onClick={run}
          disabled={state.loading}
          className="hf-btn-primary h-10 px-4 disabled:opacity-60"
        >
          {state.loading ? "Analyserer …" : state.text ? "Analysér igen" : "Analysér med AI"}
        </button>
      </div>
      <p className="hf-type-caption">
        Sender kun aggregerede tal for det valgte filter til OpenAI (ingen navne, e-mails eller bruger-id&apos;er). Koster
        et lille beløb pr. klik.
      </p>
      {state.error && <p className="hf-type-body text-hf-red-dark">{state.error}</p>}
      {state.text && <div className="hf-type-body whitespace-pre-line text-text-primary">{state.text}</div>}
    </div>
  );
}

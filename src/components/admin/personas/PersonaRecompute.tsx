"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Beregn nu" på admin → Brugere → Personas: grupperer brugerne anonymt på
// serveren og beder OpenAI om personas (docs/DECISIONS.md 2026-10-02).
// Kun fuld administratoradgang må starte en beregning (den koster penge).
export function PersonaRecompute({ canRun, hasSnapshot }: { canRun: boolean; hasSnapshot: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });

  async function run() {
    setState({ loading: true, error: null });
    try {
      const res = await fetch("/api/admin/personas", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Beregningen fejlede");
      setState({ loading: false, error: null });
      router.refresh();
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Beregningen fejlede" });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={!canRun || state.loading}
        title={canRun ? undefined : "Kræver fuld administratoradgang"}
        className="rounded-md bg-hf-fab px-3 py-1.5 text-sm text-hf-white disabled:opacity-60"
      >
        {state.loading ? "Beregner …" : hasSnapshot ? "Beregn igen med AI" : "Beregn personas med AI"}
      </button>
      {state.error && <p className="hf-type-caption text-hf-red-dark">{state.error}</p>}
    </div>
  );
}

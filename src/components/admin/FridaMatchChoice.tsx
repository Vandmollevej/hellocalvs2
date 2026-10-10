"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FridaMatchCandidate = { id: string; name: string; kcal: number; protein: number; carbs: number; fat: number };

// Admin vælger Frida-varen til et Frida-match (docs/DECISIONS.md 2026-10-10).
export function FridaMatchChoice({ reviewId, candidates }: { reviewId: string; candidates: FridaMatchCandidate[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function choose(key: string, body: Record<string, unknown>) {
    setLoading(key);
    try {
      const res = await fetch(`/api/admin/frida-estimate-reviews/${reviewId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {candidates.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => choose(c.id, { fridaProductId: c.id })}
          disabled={loading !== null}
          className="hf-type-small flex w-full items-center justify-between gap-3 rounded-md border border-hf-tan-dark px-3 py-2 text-left text-hf-black disabled:opacity-60"
        >
          <span>{loading === c.id ? "…" : c.name}</span>
          <span className="shrink-0 text-text-secondary">
            {Math.round(c.kcal)} kcal · P {c.protein.toFixed(1)} · K {c.carbs.toFixed(1)} · F {c.fat.toFixed(1)}
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => choose("none", { fridaProductId: null })}
        disabled={loading !== null}
        className="hf-type-small self-start rounded-md border border-hf-tan-dark px-3 py-1.5 text-hf-black disabled:opacity-60"
      >
        {loading === "none" ? "…" : "Ingen passer"}
      </button>
    </div>
  );
}

export function FridaMatchReset({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function reset() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/frida-estimate-reviews/${reviewId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={reset}
      disabled={loading}
      className="hf-type-small shrink-0 rounded-md border border-hf-tan-dark px-3 py-1.5 text-hf-black disabled:opacity-60"
    >
      {loading ? "…" : "Vælg igen"}
    </button>
  );
}

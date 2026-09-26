"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IngredientRequestActions({ id, name: initialName }: { id: string; name: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "add" | "reject") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/ingredient-requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, name }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.message ?? "Kunne ikke gemme");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={80}
        aria-label="Ingrediensens navn"
        className="hf-type-body flex-1 rounded border border-hf-tan-dark bg-hf-white px-3 py-2 text-hf-black"
      />
      <button
        type="button"
        disabled={busy || !name.trim()}
        onClick={() => decide("add")}
        className="hf-btn-primary px-3 py-2 disabled:opacity-50"
      >
        Tilføj globalt
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => decide("reject")}
        className="hf-type-body rounded border border-hf-tan-dark px-3 py-2 text-hf-black disabled:opacity-50"
      >
        Afvis
      </button>
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
    </div>
  );
}

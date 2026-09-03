"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Points for afsenderen registreres først, når modtageren rent faktisk
// tilføjer varen her (src/lib/forwards.ts fulfillMatchingForward, kaldt fra
// POST /api/registrations) — ikke blot ved at åbne /forward/[token].
export function AddForwardedItemButton({
  kind,
  itemId,
  name,
}: {
  kind: "PRODUCT" | "DISH";
  itemId: string;
  name: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [kind === "PRODUCT" ? "productId" : "dishId"]: itemId,
          amountGrams: 100,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Kunne ikke tilføje");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/calendar"), 1200);
    } finally {
      setSaving(false);
    }
  }

  if (done) return <p className="hf-type-body text-hf-green-dark">Tilføjet til i dag!</p>;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={add}
        disabled={saving}
        className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-50"
      >
        {saving ? "Tilføjer…" : `Tilføj ${name} til i dag`}
      </button>
      {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { localApi } from "@/lib/vault/local-api";
import { getVaultClient } from "@/lib/vault/store";
import { rememberForward, type OpenedForward } from "@/lib/vault/handlers/forwards";

// Tilføjer den videresendte vare til modtagerens dag. En delt ret kopieres
// først ind i modtagerens egen boks. Afsenderen får points, når
// registreringen er gemt (src/lib/vault/handlers/meals.ts melder linket brugt).
export function AddForwardedItemButton({
  token,
  forward,
  name,
}: {
  token: string;
  forward: OpenedForward;
  name: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const vault = getVaultClient();
    if (!vault) return;
    setSaving(true);
    setError(null);
    try {
      let body: Record<string, unknown>;
      if (forward.kind === "DISH" && forward.payload.dish) {
        const created = await localApi("/api/dishes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: forward.payload.dish.name,
            ingredients: forward.payload.dish.ingredients.map((i) => ({ productId: i.productId, grams: i.grams })),
          }),
        });
        const data = (await created.json().catch(() => ({}))) as { dish?: { id: string }; message?: string };
        if (!created.ok || !data.dish) throw new Error(data.message ?? "Kunne ikke tilføje");
        await rememberForward(vault, token, "DISH", data.dish.id);
        body = { dishId: data.dish.id, amountGrams: 100 };
      } else if (forward.productId) {
        await rememberForward(vault, token, "PRODUCT", forward.productId);
        body = { productId: forward.productId, amountGrams: 100 };
      } else {
        throw new Error("Varen findes ikke længere.");
      }

      const res = await localApi("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? "Kunne ikke tilføje");
      }
      setDone(true);
      setTimeout(() => router.push("/calendar"), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke tilføje");
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

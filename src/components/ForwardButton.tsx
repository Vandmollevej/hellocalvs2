"use client";

import { useState } from "react";
import { IconShare3 } from "@tabler/icons-react";
import { localApi } from "@/lib/vault/local-api";
import { createForwardLink, type ForwardDish } from "@/lib/vault/handlers/forwards";

// "Videresend til en ven" — afsender-siden. 5 points til afsenderen, første
// gang modtageren rent faktisk tilføjer varen (ikke ved åbning), se
// src/lib/forwards.ts. Navn og evt. egen ret krypteres i linket
// (docs/PRIVACY.md) — serveren kan ikke læse dem.
export function ForwardButton({ kind, itemId, name }: { kind: "PRODUCT" | "DISH"; itemId: string; name: string }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setSending(true);
    setError(null);
    try {
      const profile = await localApi("/api/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const senderName = (profile?.user?.displayName as string | undefined)?.trim() || null;
      let dish: ForwardDish | undefined;
      if (kind === "DISH") {
        const res = await localApi(`/api/dishes/${encodeURIComponent(itemId)}`);
        const data = (await res.json().catch(() => ({}))) as { dish?: ForwardDish };
        if (!res.ok || !data.dish) throw new Error("Retten kunne ikke findes");
        dish = { name: data.dish.name, ingredients: data.dish.ingredients };
      }
      const url = await createForwardLink({
        kind,
        productId: kind === "PRODUCT" ? itemId : undefined,
        payload: { senderName, dish },
      });
      const shareData = { title: name, text: `Prøv "${name}" i Hello Cal!`, url };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch {
          // Brugeren fortrød delingen — ignorer.
        }
        return;
      }
      await navigator.clipboard.writeText(url).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke videresende");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      {error && <span className="whitespace-nowrap text-[13px] text-hf-red-dark">{error}</span>}
      <button
        type="button"
        onClick={share}
        disabled={sending}
        aria-label="Videresend til en ven"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-hf-black disabled:opacity-50"
      >
        <IconShare3 size={24} />
      </button>
    </div>
  );
}

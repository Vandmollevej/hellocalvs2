"use client";

import { useState } from "react";
import { IconShare3 } from "@tabler/icons-react";

// "Videresend til en ven" — afsender-siden. 5 points til afsenderen, første
// gang modtageren rent faktisk tilføjer varen (ikke ved åbning), se
// src/lib/forwards.ts.
export function ForwardButton({ kind, itemId, name }: { kind: "PRODUCT" | "DISH"; itemId: string; name: string }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/forwards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "PRODUCT" ? { kind, productId: itemId } : { kind, dishId: itemId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Kunne ikke videresende");
        return;
      }
      const url = `${window.location.origin}/forward/${data.forward.token}`;
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

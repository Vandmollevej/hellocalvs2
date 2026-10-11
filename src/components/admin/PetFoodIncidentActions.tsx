"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "false-positive" | "confirm" | "reject-product";

// Knapper til gennemgang af en dyrefoder-afvisning i admin-oversigten (docs/DECISIONS.md 2026-10-07).
// "Fejl – frikend": varen var ikke dyrefoder. "Var dyrefoder": hændelsen er set.
// "Afvis vare": (fund i eksisterende vare) varen afvises.
export function PetFoodIncidentActions({ id, canRejectProduct }: { id: string; canRejectProduct: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);

  async function act(action: Action) {
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/pet-food/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => act("false-positive")}
        disabled={busy !== null}
        className="hf-btn-brand hf-btn--compact hf-btn--inline"
      >
        Fejl – frikend
      </button>
      {canRejectProduct && (
        <button
          type="button"
          onClick={() => act("reject-product")}
          disabled={busy !== null}
          className="hf-btn-danger hf-btn--compact hf-btn--inline"
        >
          Afvis vare
        </button>
      )}
      <button type="button" onClick={() => act("confirm")} disabled={busy !== null} className="hf-btn-secondary hf-btn--compact hf-btn--inline">
        Var dyrefoder
      </button>
    </div>
  );
}

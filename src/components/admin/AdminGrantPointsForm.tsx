"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_GRANT_MAX_POINTS, ADMIN_GRANT_NOTE_MAX } from "@/lib/admin-points-grant-rules";
import { useConfirmSheet } from "@/lib/use-confirm-sheet";

// Formular til Admin → Brugere → Tildel points (docs/DECISIONS.md 2026-10-03).
// Serveren håndhæver grænserne; feltet her viser dem bare.
export function AdminGrantPointsForm({ userId, displayName }: { userId: string; displayName: string }) {
  const router = useRouter();
  const { ask, sheet } = useConfirmSheet();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    ask(`Tildel ${amount} points til ${displayName}? Brugeren kan først få points igen om en måned.`, () => void grant());
  }

  async function grant() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), note }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Kunne ikke tildele points.");
        return;
      }
      setAmount("");
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {sheet}
      <label className="hf-type-body flex flex-col gap-1">
        Antal points (højst {ADMIN_GRANT_MAX_POINTS} = én gratis måned)
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={ADMIN_GRANT_MAX_POINTS}
          step={1}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="hf-field rounded-md border border-hf-tan-dark bg-hf-white px-3"
        />
      </label>
      <label className="hf-type-body flex flex-col gap-1">
        Begrundelse (kun synlig for admin)
        <textarea
          required
          rows={3}
          maxLength={ADMIN_GRANT_NOTE_MAX}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Fx kompensation for nedetid 2. oktober"
          className="rounded-md border border-hf-tan-dark bg-hf-white px-3 py-2"
        />
      </label>
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="self-start hf-btn-brand hf-btn--compact"
      >
        {busy ? "…" : "Tildel points"}
      </button>
    </form>
  );
}

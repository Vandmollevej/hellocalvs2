"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DishDisableButton({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await fetch(`/api/admin/dishes/${id}/disable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !disabled }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="hf-type-small shrink-0 rounded-md border border-hf-tan-dark bg-hf-white px-3 py-1.5 text-hf-black hover:border-hf-green disabled:opacity-50"
    >
      {disabled ? "Aktivér" : "Disable"}
    </button>
  );
}

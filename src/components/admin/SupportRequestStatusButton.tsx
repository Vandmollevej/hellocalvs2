"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SupportRequestStatusButton({ id, status }: { id: string; status: "OPEN" | "RESOLVED" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = status === "OPEN" ? "RESOLVED" : "OPEN";

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="rounded-md border border-border-strong px-2 py-1 text-xs text-text-secondary hover:bg-hf-tan disabled:opacity-50"
    >
      {status === "OPEN" ? "Marker som løst" : "Genåbn"}
    </button>
  );
}

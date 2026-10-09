"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewEnergySplitButton({ flagId }: { flagId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function review() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/energy-split-flags/${flagId}`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={review}
      disabled={loading}
      className="hf-type-small rounded-md border border-hf-tan-dark px-3 py-1.5 text-hf-green-dark disabled:opacity-60"
    >
      {loading ? "…" : "Undersøgt"}
    </button>
  );
}

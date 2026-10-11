"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClearForwardFlagButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function clear() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/clear-forward-flag`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={clear}
      disabled={loading}
      className="hf-btn-secondary hf-btn--compact hf-btn--inline"
    >
      {loading ? "…" : "Ryd flag"}
    </button>
  );
}

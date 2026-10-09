"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INTEGRATION_TESTER_POINTS } from "@/lib/points-constants";

// Godkend/afvis-knapper til Admin → Test-programmes (samme udseende som
// PendingBugReportCard).
export function TesterActions({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function act(action: "approve" | "reject") {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/test-programmes/${id}/${action}`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-shrink-0 gap-2">
      <button
        type="button"
        onClick={() => act("reject")}
        disabled={loading !== null}
        className="hf-type-body rounded-md border border-hf-tan-dark px-3 py-1.5 text-hf-red-dark disabled:opacity-60"
      >
        {loading === "reject" ? "…" : "Afvis"}
      </button>
      <button
        type="button"
        onClick={() => act("approve")}
        disabled={loading !== null}
        className="hf-btn-primary px-3 py-1.5"
      >
        {loading === "approve" ? "…" : `Godkend (+${INTEGRATION_TESTER_POINTS} points)`}
      </button>
    </div>
  );
}

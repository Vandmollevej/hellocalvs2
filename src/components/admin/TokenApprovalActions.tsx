"use client";

import { useState } from "react";

export function TokenApprovalActions({ token }: { token: string }) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/approve/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Kunne ikke gennemføre handlingen");
        return;
      }
      setDone(action);
    } finally {
      setLoading(null);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-hf-green-dark">
        {done === "approve" ? "Godkendt." : "Afvist."} Du kan lukke denne side.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => act("reject")}
          disabled={loading !== null}
          className="rounded-md border border-border-strong px-4 py-2 text-sm text-hf-red-dark disabled:opacity-60"
        >
          {loading === "reject" ? "…" : "Afvis"}
        </button>
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={loading !== null}
          className="rounded-md bg-hf-green-dark px-4 py-2 text-sm text-hf-white disabled:opacity-60"
        >
          {loading === "approve" ? "…" : "Godkend"}
        </button>
      </div>
      {error && <p className="text-sm text-hf-red-dark">{error}</p>}
    </div>
  );
}

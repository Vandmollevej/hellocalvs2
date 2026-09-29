"use client";

import { useState } from "react";

export function LoginApprovalActions({ token }: { token: string }) {
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);
  const [done, setDone] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(decision: "approve" | "deny") {
    setLoading(decision);
    setError(null);
    try {
      const res = await fetch(`/api/admin/login-approval/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Kunne ikke gennemføre handlingen");
        return;
      }
      setDone(decision);
    } finally {
      setLoading(null);
    }
  }

  if (done) {
    return (
      <p className="hf-type-body text-hf-green-dark">
        {done === "approve"
          ? "Godkendt. Gå tilbage til login-siden — den fortsætter automatisk."
          : "Afvist. Login-forsøget er annulleret. Skift din adgangskode, hvis det ikke var dig."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <button
        type="button"
        onClick={() => act("approve")}
        disabled={loading !== null}
        className="hf-type-body hf-type-strong rounded-md bg-hf-green-dark px-4 py-2.5 text-hf-white disabled:opacity-60"
      >
        {loading === "approve" ? "…" : "Ja, det er mig — godkend"}
      </button>
      <button
        type="button"
        onClick={() => act("deny")}
        disabled={loading !== null}
        className="hf-type-body rounded-md border border-hf-tan-dark px-4 py-2.5 text-hf-red-dark disabled:opacity-60"
      >
        {loading === "deny" ? "…" : "Nej, det er ikke mig"}
      </button>
    </div>
  );
}

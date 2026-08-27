"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Verifikation mislykkedes");
        return;
      }
      router.push("/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-xl font-semibold text-text-primary">Bekræftelseskode</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Indtast den 6-cifrede kode fra din authenticator-app.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-center text-2xl tracking-[0.4em]"
        />
        {error && <p className="text-sm text-hf-red-dark">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="rounded-md bg-hf-green-dark px-4 py-2.5 text-sm font-medium text-hf-white disabled:opacity-60"
        >
          {loading ? "Bekræfter…" : "Log ind"}
        </button>
      </form>
    </div>
  );
}

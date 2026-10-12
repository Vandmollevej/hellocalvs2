"use client";

import { useState } from "react";
import Link from "next/link";
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Verifikation mislykkedes");
        return;
      }
      if (data.approvalRequired) {
        router.push("/admin/login-approval/wait");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Kunne ikke bekræfte — tjek din forbindelse og prøv igen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hf-auth-panel">
      <h1 className="hf-type-title text-hf-black">Bekræftelseskode</h1>
      <p className="hf-type-body mb-8 text-text-secondary">
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
          className="hf-input"
        />
        {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="hf-btn-primary hf-btn--large"
        >
          {loading ? "Bekræfter…" : "Log ind"}
        </button>
      </form>
      <Link href="/admin/login" className="hf-type-body mt-4 text-center text-hf-green-dark underline">
        Ingen adgang til authenticator? Log ind med Face ID / passkey
      </Link>
    </div>
  );
}

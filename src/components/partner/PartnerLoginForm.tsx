"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Login til partnerportalen (docs/DECISIONS.md 2026-10-02). Bevidst ingen
// "Opret konto"-mulighed: B2B-konti oprettes kun af en Hello Cal-administrator.
export function PartnerLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/partner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Login mislykkedes");
        return;
      }
      router.push("/partner");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "hf-type-body hf-field w-full rounded-md border border-hf-tan-dark bg-hf-white px-3";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="hf-type-body flex flex-col gap-1">
        E-mail
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </label>
      <label className="hf-type-body flex flex-col gap-1">
        Adgangskode
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <button type="submit" disabled={loading} className="hf-btn-primary w-full py-2.5 disabled:opacity-60">
        {loading ? "Logger ind…" : "Log ind"}
      </button>
      <p className="hf-type-small text-text-secondary">
        Adgang til partnerportalen oprettes af Hello Cal. Mangler I en adgang, eller er linket udløbet, så skriv til os via{" "}
        <a href="/business#kontakt" className="text-hf-green-dark underline">
          Business-siden
        </a>
        .
      </p>
    </form>
  );
}

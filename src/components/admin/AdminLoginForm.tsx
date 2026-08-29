"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Login mislykkedes");
        return;
      }
      router.push("/admin/verify");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithPasskey() {
    setError(null);
    setPasskeyBusy(true);
    try {
      const optionsRes = await fetch("/api/admin/passkey/authenticate/options", { method: "POST" });
      if (!optionsRes.ok) throw new Error("Kunne ikke starte passkey-login");
      const optionsJSON = await optionsRes.json();

      const authResponse = await startAuthentication({ optionsJSON });

      const verifyRes = await fetch("/api/admin/passkey/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: authResponse }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data.message ?? "Kunne ikke logge ind med passkey");

      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke logge ind med passkey");
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-xl font-semibold text-text-primary">Admin-login</h1>
      <p className="mb-6 text-sm text-text-secondary">Log ind for at godkende nye produkter og billeder.</p>

      <button
        type="button"
        onClick={loginWithPasskey}
        disabled={passkeyBusy}
        className="mb-4 rounded-md border border-hf-green-dark px-4 py-2.5 text-sm font-medium text-hf-green-dark disabled:opacity-60"
      >
        {passkeyBusy ? "Venter på Face ID…" : "Log ind med Face ID / passkey"}
      </button>
      <div className="mb-4 flex items-center gap-3 text-xs text-text-muted">
        <span className="h-px flex-1 bg-border-strong" /> eller <span className="h-px flex-1 bg-border-strong" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            autoComplete="username webauthn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-base"
          />
        </label>
        {error && <p className="text-sm text-hf-red-dark">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-hf-green-dark px-4 py-2.5 text-sm font-medium text-hf-white disabled:opacity-60"
        >
          {loading ? "Logger ind…" : "Fortsæt"}
        </button>
      </form>
    </div>
  );
}

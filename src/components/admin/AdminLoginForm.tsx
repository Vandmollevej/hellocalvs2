"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { clearSidebarState } from "@/lib/sidebar-state";

export function AdminLoginForm() {
  const router = useRouter();
  // Nyt login: sidebjælken starter med alle grupper foldet ud.
  useEffect(() => {
    clearSidebarState();
  }, []);
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

      if (data.approvalRequired) {
        router.push("/admin/login-approval/wait");
        return;
      }
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
      <h1 className="hf-type-title text-hf-black">Admin-login</h1>
      <p className="hf-type-body mb-8 text-text-secondary">Log ind for at godkende nye varer og billeder.</p>

      <button
        type="button"
        onClick={loginWithPasskey}
        disabled={passkeyBusy}
        className="hf-btn-secondary hf-btn--compact hf-btn--inline"
      >
        {passkeyBusy ? "Venter på Face ID…" : "Log ind med Face ID / passkey"}
      </button>
      <p className="hf-type-section-title">eller</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="hf-type-body flex flex-col gap-1">
          Email
          <input
            type="email"
            required
            autoComplete="username webauthn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="hf-input"
          />
        </label>
        <label className="hf-type-body flex flex-col gap-1">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="hf-input"
          />
        </label>
        {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="hf-btn-brand hf-btn--compact"
        >
          {loading ? "Logger ind…" : "Fortsæt"}
        </button>
      </form>
      <a href="/admin/forgot-password" className="hf-type-body mt-4 text-center text-hf-green-dark underline">
        Glemt adgangskode?
      </a>
    </div>
  );
}

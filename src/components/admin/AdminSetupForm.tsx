"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "credentials" | "confirm";

export function AdminSetupForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmitCredentials(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Kunne ikke oprette administrator");
        return;
      }
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setStep("confirm");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitConfirm(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/setup/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Forkert kode");
        return;
      }
      router.push("/admin/login");
    } finally {
      setLoading(false);
    }
  }

  if (step === "confirm") {
    return (
      <div className="flex flex-col gap-4">
        {qrCodeDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrCodeDataUrl} alt="QR-kode til authenticator-app" className="mx-auto h-48 w-48" />
        )}
        {secret && (
          <p className="break-all rounded-md bg-surface-2 px-3 py-2 text-center text-xs text-text-muted">
            Kan ikke scanne? Indtast koden manuelt: <span className="font-mono">{secret}</span>
          </p>
        )}
        <form onSubmit={onSubmitConfirm} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Bekræftelseskode fra appen
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-center text-2xl tracking-[0.4em]"
            />
          </label>
          {error && <p className="text-sm text-hf-red-dark">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="rounded-md bg-hf-green-dark px-4 py-2.5 text-sm font-medium text-hf-white disabled:opacity-60"
          >
            {loading ? "Bekræfter…" : "Bekræft og opret"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmitCredentials} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-base"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password (mindst 12 tegn)
        <input
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
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
        {loading ? "Genererer…" : "Fortsæt til QR-kode"}
      </button>
    </form>
  );
}

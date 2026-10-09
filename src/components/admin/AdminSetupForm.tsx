"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNewPasswordFields } from "@/components/admin/AdminNewPasswordFields";
import { ADMIN_PASSWORD_REQUIREMENTS_MESSAGE, isAdminPasswordValid } from "@/lib/admin-password-policy";

type Step = "credentials" | "confirm";

export function AdminSetupForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);

  async function onSubmitCredentials(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setAttempted(true);
    if (!isAdminPasswordValid(password)) {
      setError(ADMIN_PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }
    if (password !== passwordConfirm) {
      setError("Adgangskoderne er ikke ens");
      return;
    }
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
      router.push("/admin/passkeys");
      router.refresh();
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
          <p className="hf-type-small break-all rounded-md bg-hf-white px-3 py-2 text-center text-text-muted">
            Kan ikke scanne? Indtast koden manuelt: <span className="font-mono">{secret}</span>
          </p>
        )}
        <form onSubmit={onSubmitConfirm} className="flex flex-col gap-4">
          <label className="hf-type-body flex flex-col gap-1">
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
              className="hf-type-page-title hf-field rounded-md border border-hf-tan-dark bg-hf-white px-3 text-center tracking-[0.4em]"
            />
          </label>
          {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="hf-btn-brand hf-btn--compact"
          >
            {loading ? "Bekræfter…" : "Bekræft og opret"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmitCredentials} className="flex flex-col gap-4">
      <label className="hf-type-body flex flex-col gap-1">
        Email
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="hf-type-body hf-field rounded-md border border-hf-tan-dark bg-hf-white px-3"
        />
      </label>
      <AdminNewPasswordFields
        label="Adgangskode"
        password={password}
        confirm={passwordConfirm}
        onPasswordChange={setPassword}
        onConfirmChange={setPasswordConfirm}
        showErrors={attempted}
      />
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="hf-btn-brand hf-btn--compact"
      >
        {loading ? "Genererer…" : "Fortsæt til QR-kode"}
      </button>
    </form>
  );
}

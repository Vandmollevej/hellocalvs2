"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminNewPasswordFields } from "@/components/admin/AdminNewPasswordFields";
import { ADMIN_PASSWORD_REQUIREMENTS_MESSAGE, isAdminPasswordValid } from "@/lib/admin-password-policy";

export function AdminResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [code, setCode] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);

  async function onSubmitPassword(event: React.FormEvent) {
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
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Noget gik galt");
        return;
      }
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Noget gik galt");
        return;
      }
      router.push("/admin/passkeys");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-sm px-4 py-10">
        <p className="hf-type-body mb-4">Linket er ugyldigt.</p>
        <Link href="/admin/forgot-password" className="hf-type-body text-hf-green-dark underline">
          Anmod om et nyt link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <h1 className="hf-type-page-title mb-1 text-text-primary">Nulstil admin-adgang</h1>
      {qrCodeDataUrl ? (
        <>
          <p className="hf-type-body mb-4 text-text-secondary">
            Scan QR-koden med din authenticator-app og indtast koden. Den gamle kode virker ikke længere.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCodeDataUrl} alt="QR-kode til authenticator" className="mx-auto mb-3 h-48 w-48" />
          {secret && (
            <p className="hf-type-small mb-4 text-center text-text-muted">
              Kan ikke scanne? Indtast manuelt: <span className="font-mono">{secret}</span>
            </p>
          )}
          <form onSubmit={onSubmitCode} className="flex flex-col gap-4">
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
            {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="hf-btn-brand hf-btn--compact"
            >
              {loading ? "Bekræfter…" : "Bekræft og log ind"}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={onSubmitPassword} className="mt-4 flex flex-col gap-4">
          <AdminNewPasswordFields
            label="Ny adgangskode"
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
            {loading ? "Gemmer…" : "Fortsæt til QR-kode"}
          </button>
        </form>
      )}
    </div>
  );
}

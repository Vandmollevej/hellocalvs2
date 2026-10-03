"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNewPasswordFields } from "@/components/admin/AdminNewPasswordFields";
import { PartnerCodeInput } from "@/components/partner/PartnerCodeInput";
import { ADMIN_PASSWORD_REQUIREMENTS_MESSAGE, isAdminPasswordValid } from "@/lib/admin-password-policy";

type Step = "password" | "confirm";

// Tilmelding via invitation: 1) vælg adgangskode (samme krav som admin),
// 2) scan QR-koden og bekræft med første 2-faktor-kode. Først derefter oprettes
// adgangen, og brugeren er logget ind. 2-faktor er obligatorisk ved hvert login.
export function PartnerInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);

  async function post(path: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/partner/invite/${token}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; qrCodeDataUrl?: string; secret?: string };
    return { ok: res.ok, data };
  }

  async function onSubmitPassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setAttempted(true);
    if (!isAdminPasswordValid(password)) return setError(ADMIN_PASSWORD_REQUIREMENTS_MESSAGE);
    if (password !== confirm) return setError("Adgangskoderne er ikke ens");
    setLoading(true);
    try {
      const { ok, data } = await post("start", { password });
      if (!ok) return setError(data.message ?? "Kunne ikke starte tilmeldingen");
      setQrCodeDataUrl(data.qrCodeDataUrl ?? null);
      setSecret(data.secret ?? null);
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
      const { ok, data } = await post("confirm", { code });
      if (!ok) return setError(data.message ?? "Forkert kode");
      router.push("/partner");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (step === "confirm") {
    return (
      <div className="flex flex-col gap-4">
        <p className="hf-type-body text-text-secondary">
          Scan QR-koden med en authenticator-app (fx Google Authenticator eller Authy), og skriv den kode, appen viser.
        </p>
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
          <PartnerCodeInput code={code} onChange={setCode} />
          {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
          <button type="submit" disabled={loading || code.length !== 6} className="hf-btn-primary w-full py-2.5 disabled:opacity-60">
            {loading ? "Bekræfter…" : "Bekræft og opret adgang"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmitPassword} className="flex flex-col gap-4">
      <AdminNewPasswordFields
        label="Vælg adgangskode"
        password={password}
        confirm={confirm}
        onPasswordChange={setPassword}
        onConfirmChange={setConfirm}
        showErrors={attempted}
      />
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <button type="submit" disabled={loading} className="hf-btn-primary w-full py-2.5 disabled:opacity-60">
        {loading ? "Genererer…" : "Fortsæt til QR-kode"}
      </button>
    </form>
  );
}

"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanAuthScreen } from "@/components/scan/ScanAuthScreen";
import { TextField } from "@/components/hf/TextField";
import { ActionButton } from "@/components/hf/ActionButton";

// Opsætning fra invitationslinket: vælg brugernavn og adgangskode, scan
// QR-koden i en autenticator-app og bekræft med den første kode.
export default function ScanSetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [qr, setQr] = useState<{ qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: object) {
    setBusy(true);
    setError(null);
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    const data = (await response.json().catch(() => ({}))) as { message?: string; qrCode?: string; secret?: string };
    if (!response.ok) setError(data.message ?? "Noget gik galt");
    return response.ok ? data : null;
  }

  async function start(event: React.FormEvent) {
    event.preventDefault();
    const data = await post("/api/scan/setup/start", { token, username, password });
    if (data?.qrCode && data.secret) setQr({ qrCode: data.qrCode, secret: data.secret });
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (await post("/api/scan/setup/confirm", { token, code })) router.replace("/scan");
  }

  return (
    <ScanAuthScreen title="Opret adgang">
      {!qr ? (
        <form onSubmit={start} className="flex flex-col gap-4">
          <p className="hf-type-body">Vælg det brugernavn og den adgangskode, du vil logge ind med.</p>
          <TextField label="Brugernavn" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required />
          <TextField label="Adgangskode (mindst 10 tegn)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={10} required />
          {error && <p className="hf-type-caption text-center">{error}</p>}
          <ActionButton type="submit" disabled={busy} className="h-12 disabled:opacity-40">
            <span className="hf-type-button">Fortsæt</span>
          </ActionButton>
        </form>
      ) : (
        <form onSubmit={confirm} className="flex flex-col gap-4">
          <p className="hf-type-body">
            Scan koden med en autenticator-app (fx Google Authenticator eller Microsoft Authenticator), og indtast den 6-cifrede kode.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.qrCode} alt="QR-kode til autenticator-app" className="mx-auto h-48 w-48" />
          <p className="hf-type-caption break-all text-center">{qr.secret}</p>
          <TextField label="Kode" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
          {error && <p className="hf-type-caption text-center">{error}</p>}
          <ActionButton type="submit" disabled={busy} className="h-12 disabled:opacity-40">
            <span className="hf-type-button">Aktivér</span>
          </ActionButton>
        </form>
      )}
    </ScanAuthScreen>
  );
}

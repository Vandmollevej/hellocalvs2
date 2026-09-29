"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanAuthScreen } from "@/components/scan/ScanAuthScreen";
import { TextField } from "@/components/hf/TextField";
import { ActionButton } from "@/components/hf/ActionButton";
import { hasScanPasskeyOnDevice, loginScanWithPasskey } from "@/lib/scan/passkey-client";

// Login i Oprettelses-appen: brugernavn + adgangskode, derefter tofaktor.
export default function ScanLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [faceId, setFaceId] = useState(false);

  useEffect(() => {
    // localStorage findes kun i browseren, så knappen vises efter første render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFaceId(hasScanPasskeyOnDevice());
  }, []);

  async function faceIdLogin() {
    setBusy(true);
    setError(null);
    try {
      await loginScanWithPasskey();
      router.push("/scan");
    } catch (err) {
      setFaceId(hasScanPasskeyOnDevice());
      if (!(err instanceof Error && err.name === "NotAllowedError")) setError(err instanceof Error ? err.message : "Login fejlede");
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/scan/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (response.ok) router.push("/scan/verify");
    else setError(((await response.json().catch(() => ({}))) as { message?: string }).message ?? "Login fejlede");
  }

  return (
    <ScanAuthScreen title="Oprettelses-app">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Brugernavn" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required />
        <TextField label="Adgangskode" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <p className="hf-type-caption text-center">{error}</p>}
        <ActionButton type="submit" disabled={busy} className="hf-control disabled:opacity-40">
          <span className="hf-type-button">Log ind</span>
        </ActionButton>
        {faceId && (
          <ActionButton variant="secondary" type="button" disabled={busy} onClick={() => void faceIdLogin()} className="hf-control disabled:opacity-40">
            <span className="hf-type-button">Log ind med Face ID</span>
          </ActionButton>
        )}
        <p className="hf-type-caption text-center" style={{ color: "var(--hf-color-text-secondary)" }}>
          Kun for inviterede medarbejdere.
        </p>
      </form>
    </ScanAuthScreen>
  );
}

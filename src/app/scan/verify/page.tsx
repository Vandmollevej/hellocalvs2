"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanAuthScreen } from "@/components/scan/ScanAuthScreen";
import { TextField } from "@/components/hf/TextField";
import { ActionButton } from "@/components/hf/ActionButton";

// Tofaktor: 6-cifret kode fra autenticator-appen.
export default function ScanVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/scan/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setBusy(false);
    if (response.ok) router.replace("/scan");
    else setError(((await response.json().catch(() => ({}))) as { message?: string }).message ?? "Forkert kode");
  }

  return (
    <ScanAuthScreen title="Tofaktor-godkendelse">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="hf-type-body">Indtast koden fra din autenticator-app.</p>
        <TextField label="Kode" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        {error && <p className="hf-type-caption text-center">{error}</p>}
        <ActionButton type="submit" disabled={busy} className="h-12 disabled:opacity-40">
          <span className="hf-type-button">Bekræft</span>
        </ActionButton>
      </form>
    </ScanAuthScreen>
  );
}

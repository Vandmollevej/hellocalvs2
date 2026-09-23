"use client";

import { useCallback, useEffect, useState } from "react";
import { generateBoxKeyPair, toBase64Url } from "@/lib/vault/crypto";
import { decodeBackup, encodeBackup, loadSupportKey, saveSupportKey } from "@/components/admin/support-key-store";

type ActiveKey = { id: string; publicKey: string; createdAt: string } | null;

// Supports nøglepar (docs/PRIVACY.md "Support"). Brugernes supportpakker
// forsegles til den offentlige nøgle; kun en browser med den private nøgle
// kan åbne dem. Uden nøgle i denne browser kan pakker ikke læses her.
export function SupportKeyManager() {
  const [active, setActive] = useState<ActiveKey>(null);
  const [hasPrivate, setHasPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/support/key", { cache: "no-store" });
    const key = res.ok ? ((await res.json()) as { key: ActiveKey }).key : null;
    setActive(key);
    setHasPrivate(Boolean(key && (await loadSupportKey(key.id))));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function download(contents: string) {
    const url = URL.createObjectURL(new Blob([contents], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "hello-cal-supportnoegle.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function createKey() {
    if (active && !window.confirm("Lav en ny supportnøgle? Pakker lavet til den gamle nøgle kan kun åbnes med dens backupfil.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const pair = await generateBoxKeyPair();
      const res = await fetch("/api/admin/support/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: pair.publicKey }),
      });
      const data = (await res.json()) as { key?: { id: string } };
      if (!res.ok || !data.key) throw new Error("Nøglen kunne ikke gemmes");
      const stored = { keyId: data.key.id, publicKey: pair.publicKey, privateKeyPkcs8: toBase64Url(pair.privateKeyPkcs8) };
      await saveSupportKey(stored);
      download(encodeBackup(stored));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      await saveSupportKey(decodeBackup(await file.text()));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ugyldig fil");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-4">
      <p className="font-medium text-text-primary">Supportnøgle</p>
      <p className="text-sm text-text-secondary">
        {!active
          ? "Der er ingen supportnøgle endnu. Brugere kan ikke dele data med Support, før der er lavet en."
          : hasPrivate
            ? "Denne browser kan åbne brugernes supportpakker."
            : "Denne browser har ikke den private nøgle. Indlæs backupfilen for at kunne åbne pakker."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={createKey}
          className="rounded-md bg-hf-green-dark px-3 py-1.5 text-sm text-hf-white disabled:opacity-60"
        >
          {active ? "Lav ny nøgle" : "Lav supportnøgle"}
        </button>
        {active && !hasPrivate && (
          <label className="cursor-pointer rounded-md border border-border-strong px-3 py-1.5 text-sm">
            Indlæs backupfil
            <input type="file" accept=".txt,text/plain" className="sr-only" onChange={(e) => importBackup(e.target.files?.[0])} />
          </label>
        )}
      </div>
      <p className="text-xs text-text-muted">
        Backupfilen downloades, når nøglen laves. Opbevar den sikkert — uden den kan pakkerne ikke åbnes på andre
        computere.
      </p>
      {error && <p className="text-sm text-hf-red-dark">{error}</p>}
    </div>
  );
}

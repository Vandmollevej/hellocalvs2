"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

type Passkey = {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(signal?: AbortSignal) {
    const res = await fetch("/api/admin/passkey", { signal });
    if (res.ok) setPasskeys((await res.json()).passkeys);
  }

  useEffect(() => {
    const controller = new AbortController();
    async function loadPasskeys() {
      const res = await fetch("/api/admin/passkey", { signal: controller.signal });
      if (res.ok) setPasskeys((await res.json()).passkeys);
    }
    loadPasskeys().catch(() => {});
    return () => controller.abort();
  }, []);

  async function addPasskey() {
    setError(null);
    setBusy(true);
    try {
      const optionsRes = await fetch("/api/admin/passkey/register/options", { method: "POST" });
      if (!optionsRes.ok) throw new Error((await optionsRes.json()).message ?? "Kunne ikke starte registrering");
      const optionsJSON = await optionsRes.json();

      const registrationResponse = await startRegistration({ optionsJSON });

      const name = window.prompt("Navngiv denne enhed (fx \"Peters iPhone\")", "iPhone") ?? undefined;
      const verifyRes = await fetch("/api/admin/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: registrationResponse, name }),
      });
      if (!verifyRes.ok) throw new Error((await verifyRes.json()).message ?? "Kunne ikke gemme passkey");

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette passkey");
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(id: string) {
    if (!window.confirm("Fjern denne passkey?")) return;
    await fetch(`/api/admin/passkey/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Log ind med Face ID/Touch ID i stedet for password + kode — fx på din iPhone via iCloud-nøglering.
        </p>
        <button
          type="button"
          onClick={addPasskey}
          disabled={busy}
          className="flex-shrink-0 rounded-md bg-hf-green-dark px-3 py-1.5 text-sm text-hf-white disabled:opacity-60"
        >
          {busy ? "…" : "Tilføj passkey"}
        </button>
      </div>
      {error && <p className="text-sm text-hf-red-dark">{error}</p>}

      {passkeys === null ? null : passkeys.length === 0 ? (
        <p className="text-sm text-text-muted">Ingen passkeys endnu.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {passkeys.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border-strong bg-surface-2 px-4 py-3"
            >
              <div>
                <p className="font-medium text-text-primary">{p.name || "Passkey"}</p>
                <p className="text-xs text-text-muted">
                  Oprettet {new Date(p.createdAt).toLocaleDateString("da-DK")}
                  {p.lastUsedAt ? ` · Sidst brugt ${new Date(p.lastUsedAt).toLocaleDateString("da-DK")}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removePasskey(p.id)}
                className="rounded-md border border-border-strong px-2.5 py-1 text-xs text-hf-red-dark"
              >
                Fjern
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

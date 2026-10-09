"use client";

import { useEffect, useRef, useState } from "react";
import { startRegistration, type RegistrationResponseJSON } from "@simplewebauthn/browser";
import { BottomSheet, useBottomSheetClose } from "@/components/hf/BottomSheet";
import { useConfirmSheet } from "@/lib/use-confirm-sheet";

type Passkey = {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

// Navngivning af en nyregistreret enhed. Swipe ned/scrim gemmer uden navn
// (enheden er allerede registreret hos browseren).
function PasskeyNameSheet({ onDone }: { onDone: (name?: string) => void }) {
  const nameRef = useRef<string | undefined>(undefined);
  return (
    <BottomSheet ariaLabel="Navngiv denne enhed" onClose={() => onDone(nameRef.current)}>
      <PasskeyNameForm onSave={(name) => (nameRef.current = name)} />
    </BottomSheet>
  );
}

function PasskeyNameForm({ onSave }: { onSave: (name?: string) => void }) {
  const [name, setName] = useState("iPhone");
  const close = useBottomSheetClose();
  return (
    <div className="flex flex-col gap-3 p-4">
      <label className="flex flex-col gap-1">
        <span className="hf-type-body text-hf-black">Navngiv denne enhed (fx &quot;Peters iPhone&quot;)</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          className="hf-field hf-type-body rounded-md border border-hf-tan-dark bg-page-bg px-3 text-hf-black outline-none focus:border-hf-green"
        />
      </label>
      <button
        type="button"
        onClick={() => {
          onSave(name.trim() || undefined);
          close();
        }}
        className="hf-control hf-btn-primary w-full px-4"
      >
        Gem
      </button>
    </div>
  );
}

export function PasskeyManager() {
  const { ask, sheet } = useConfirmSheet();
  const [naming, setNaming] = useState<RegistrationResponseJSON | null>(null);
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

      // Enheden er registreret; navngivningen sker i et bundark (ingen window.prompt).
      setNaming(await startRegistration({ optionsJSON }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette passkey");
      setBusy(false);
    }
  }

  async function finishRegistration(registrationResponse: RegistrationResponseJSON, name?: string) {
    setNaming(null);
    try {
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

  function removePasskey(id: string) {
    ask("Fjern denne passkey?", () => {
      void (async () => {
        await fetch(`/api/admin/passkey/${id}`, { method: "DELETE" });
        await load();
      })();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {sheet}
      {naming && <PasskeyNameSheet onDone={(name) => void finishRegistration(naming, name)} />}
      <div className="flex items-center justify-between gap-3">
        <p className="hf-type-body text-text-secondary">
          Log ind med Face ID/Touch ID i stedet for password + kode — fx på din iPhone via iCloud-nøglering.
        </p>
        <button
          type="button"
          onClick={addPasskey}
          disabled={busy}
          className="hf-btn-primary flex-shrink-0 px-3 py-1.5"
        >
          {busy ? "…" : "Tilføj passkey"}
        </button>
      </div>
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}

      {passkeys === null ? null : passkeys.length === 0 ? (
        <p className="hf-type-body text-text-muted">Ingen passkeys endnu.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {passkeys.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between hf-surface px-4 py-3"
            >
              <div>
                <p className="hf-type-strong text-hf-black">{p.name || "Passkey"}</p>
                <p className="hf-type-small text-text-muted">
                  Oprettet {new Date(p.createdAt).toLocaleDateString("da-DK")}
                  {p.lastUsedAt ? ` · Sidst brugt ${new Date(p.lastUsedAt).toLocaleDateString("da-DK")}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removePasskey(p.id)}
                className="hf-type-small rounded-md border border-hf-tan-dark px-2.5 py-1 text-hf-red-dark"
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

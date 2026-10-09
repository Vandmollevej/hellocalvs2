"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/hf/ActionButton";
import { isScanPasskeySupported, registerScanPasskey, removeScanPasskey } from "@/lib/scan/passkey-client";

type Item = { id: string; name: string | null; lastUsedAt: string | null };

// Profil → Face ID: slå til på denne telefon eller fjern en gemt nøgle.
export function ScanPasskeySection({ passkeys }: { passkeys: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      if (!(err instanceof Error && err.name === "NotAllowedError")) setError(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <p className="hf-type-label">Face ID</p>
      {passkeys.length > 0 && (
        <ul className="overflow-hidden bg-hf-card rounded-card">
          {passkeys.map((p) => (
            <li key={p.id} className="flex min-h-12 items-center justify-between gap-4 border-b px-4 py-2 last:border-b-0 border-hf-line">
              <span className="hf-type-body">
                {p.name || "Face ID"}
                <span className="hf-type-caption block text-hf-text-secondary">
                  {p.lastUsedAt ? `Sidst brugt ${new Date(p.lastUsedAt).toLocaleDateString("da-DK")}` : "Ikke brugt endnu"}
                </span>
              </span>
              <button type="button" disabled={busy} onClick={() => void run(() => removeScanPasskey(p.id))} className="hf-type-body underline disabled:opacity-40">
                Fjern
              </button>
            </li>
          ))}
        </ul>
      )}
      <ActionButton
        type="button"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            if (!isScanPasskeySupported()) throw new Error("Telefonen understøtter ikke Face ID-login.");
            await registerScanPasskey("Face ID");
          })
        }
        className="hf-control disabled:opacity-40"
      >
        <span className="hf-type-button">Slå Face ID til på denne telefon</span>
      </ActionButton>
      {error && <p className="hf-type-caption">{error}</p>}
      <p className="hf-type-caption text-hf-text-secondary">
        Med Face ID logger du ind uden adgangskode og kode fra authenticator-appen.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { fromBase64Url, openSealedBox, type SealedBox } from "@/lib/vault/crypto";
import { loadSupportKey } from "@/components/admin/support-key-store";

type Package = SealedBox & { keyId: string; createdAt: string };
type Contents = { createdAt: string; categories: Record<string, unknown> };

// Åbner brugerens supportpakke i admins browser med Supports private nøgle
// (docs/PRIVACY.md "Support"). Serveren udleverer kun pakken, mens
// tilladelsen er aktiv; indholdet dekrypteres aldrig på serveren.
export function SupportPackageViewer({ grantId, labels }: { grantId: string; labels: Record<string, string> }) {
  const [contents, setContents] = useState<Contents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/packages?grantId=${encodeURIComponent(grantId)}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { package?: Package | null; message?: string };
      if (!res.ok) throw new Error(data.message ?? "Pakken kunne ikke hentes");
      if (!data.package) throw new Error("Brugeren har ikke delt en pakke endnu");
      const key = await loadSupportKey(data.package.keyId);
      if (!key) throw new Error("Denne browser har ikke den private nøgle til pakken");
      setContents(await openSealedBox<Contents>(fromBase64Url(key.privateKeyPkcs8), key.publicKey, data.package));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pakken kunne ikke åbnes");
    } finally {
      setBusy(false);
    }
  }

  if (!contents) {
    return (
      <div className="mt-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={open}
          disabled={busy}
          className="self-start rounded-md border border-border-strong px-2.5 py-1 text-xs disabled:opacity-60"
        >
          {busy ? "Åbner…" : "Åbn delte data"}
        </button>
        {error && <p className="text-xs text-hf-red-dark">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-xs text-text-muted">Delt {new Date(contents.createdAt).toLocaleString("da-DK")}</p>
      {Object.entries(contents.categories).map(([key, value]) => (
        <details key={key} className="rounded-md border border-border-strong bg-surface-1 px-3 py-2">
          <summary className="cursor-pointer text-sm text-text-primary">{labels[key] ?? key}</summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-text-secondary">
            {value === null ? "Ligger på serveren (se admin)." : JSON.stringify(value, null, 2)}
          </pre>
        </details>
      ))}
      <button type="button" onClick={() => setContents(null)} className="self-start text-xs underline">
        Luk
      </button>
    </div>
  );
}

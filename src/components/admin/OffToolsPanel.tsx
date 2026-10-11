"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Værktøjer på admin → Varedatabase → Open Food Facts: hent én stregkode, læs et
// OFF-udtræk ind (JSON fra Excelark/off_hent.py, fx Backup/off_raa/store_lidl.json)
// og kør opdelingen igen på de gemte rå svar. Alt går via /api/admin/off.

type Props = { canEdit: boolean };

async function call(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/off", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok && data.ok !== false, data };
}

export function OffToolsPanel({ canEdit }: Props) {
  const router = useRouter();
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!canEdit) {
    return (
      <p className="hf-type-small text-text-muted">Kun administratorer med fuld adgang kan hente og indlæse OFF-varer.</p>
    );
  }

  async function fetchOne() {
    if (!barcode.trim()) return;
    setBusy(true);
    setMessage("Henter fra Open Food Facts …");
    try {
      const { data } = await call({ op: "fetch", barcode });
      setMessage(String(data.message ?? "Færdig"));
      if (data.ok) {
        setBarcode("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function importFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    let saved = 0;
    let skipped = 0;
    let blocked = 0;
    let failed = 0;
    try {
      for (const file of Array.from(files)) {
        const parsed = JSON.parse(await file.text()) as unknown;
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray((parsed as { products?: unknown[] })?.products)
            ? (parsed as { products: unknown[] }).products
            : [];
        for (let i = 0; i < list.length; i += 100) {
          setMessage(`${file.name}: ${Math.min(i + 100, list.length)} / ${list.length} …`);
          const { ok, data } = await call({ op: "import", products: list.slice(i, i + 100) });
          if (!ok) {
            setMessage(String(data.message ?? "Indlæsningen mislykkedes"));
            return;
          }
          saved += Number(data.saved ?? 0);
          skipped += Number(data.skipped ?? 0);
          blocked += Number(data.blocked ?? 0);
          failed += Number(data.failed ?? 0);
        }
      }
      setMessage(
        `Indlæst: ${saved} varer gemt, ${skipped} sprunget over, ${blocked} dyrefoder afvist${failed ? `, ${failed} fejlede` : ""}.`,
      );
      router.refresh();
    } catch {
      setMessage("Filen kunne ikke læses — den skal være en JSON-liste af OFF-varer.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function resplitAll() {
    setBusy(true);
    let processed = 0;
    let after: string | null = null;
    try {
      for (let guard = 0; guard < 500; guard += 1) {
        setMessage(`Kører opdelingen igen … ${processed} varer`);
        const { ok, data } = await call({ op: "resplit", afterId: after });
        if (!ok) {
          setMessage(String(data.message ?? "Mislykkedes"));
          return;
        }
        processed += Number(data.processed ?? 0);
        after = typeof data.nextAfterId === "string" ? data.nextAfterId : null;
        if (!after) break;
      }
      setMessage(`Opdelingen er kørt igen på ${processed} varer.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hf-panel flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="hf-type-title text-hf-black">Hent og indlæs</h2>
        <p className="hf-type-body text-text-secondary">
          Hent en stregkode fra Open Food Facts, læs et udtræk ind, eller kør opdelingen igen efter nye regler.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          inputMode="numeric"
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
          placeholder="Stregkode (EAN)"
          disabled={busy}
          className="hf-type-body hf-field w-full rounded-md border border-hf-tan-dark bg-hf-white px-3 text-hf-black outline-none placeholder:text-text-muted focus:border-hf-green sm:max-w-xs"
        />
        <button type="button" onClick={fetchOne} disabled={busy || !barcode.trim()} className="hf-btn-secondary hf-btn--compact">
          Hent fra OFF
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          multiple
          disabled={busy}
          onChange={(event) => void importFiles(event.target.files)}
          className="hf-type-body text-text-secondary"
        />
        <button type="button" onClick={resplitAll} disabled={busy} className="hf-btn-secondary hf-btn--compact">
          Kør opdelingen igen på alle
        </button>
      </div>

      {message && <p className="hf-type-body text-text-secondary">{message}</p>}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { OFF_QUALITY_RATING_LABELS, type OffQualityRating } from "@/lib/off-quality";
import { sendAllMatchingToScanApp, sendToScanApp, withdrawFromScanApp } from "./actions";

// Listen over Open Food Facts-varer med afkrydsning (docs/DECISIONS.md
// 2026-10-11). De valgte varer sendes til scan-appen, hvor de står som ikke
// scannede; "send alle" sender alle varer, der matcher de viste filtre.

export type OffQualityRow = {
  productId: string;
  name: string;
  brand: string | null;
  packageSizeText: string | null;
  barcode: string | null;
  imageUrl: string | null;
  score: number;
  rating: OffQualityRating;
  groups: { label: string; comments: string[] }[];
  scanRequestedAt: string | null;
  scanDoneAt: string | null;
};

const RATING_TONE: Record<OffQualityRating, string> = {
  POOR: "border border-hf-red-dark text-hf-red-dark",
  WEAK: "bg-hf-warning-bg text-hf-warning",
  OK: "bg-hf-tan text-hf-black",
  GOOD: "bg-hf-green-light text-hf-green-dark",
};

const dateFormat = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" });

function ScanStatus({ row }: { row: OffQualityRow }) {
  if (row.scanDoneAt) {
    return <span className="hf-type-small text-hf-green-dark">Scannet {dateFormat.format(new Date(row.scanDoneAt))}</span>;
  }
  if (row.scanRequestedAt) {
    return (
      <span className="hf-type-small text-hf-warning">
        Sendt {dateFormat.format(new Date(row.scanRequestedAt))} — ikke scannet endnu
      </span>
    );
  }
  return <span className="hf-type-small text-text-muted">Ikke sendt</span>;
}

export function OffQualityTable({
  rows,
  returnTo,
  matchingTotal,
}: {
  rows: OffQualityRow[];
  returnTo: string;
  matchingTotal: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.productId));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.productId)));
  }

  return (
    <form className="flex flex-col gap-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="hf-panel flex flex-wrap items-center gap-3">
        <label className="hf-type-body flex items-center gap-2">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={rows.length === 0} />
          Vælg alle på siden
        </label>
        <span className="hf-type-caption">{selected.size} valgt</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="submit"
            formAction={sendToScanApp}
            disabled={selected.size === 0}
            className="hf-btn-secondary hf-btn--compact w-fit disabled:opacity-50"
          >
            Send valgte til scan-appen
          </button>
          <button
            type="submit"
            formAction={withdrawFromScanApp}
            disabled={selected.size === 0}
            className="hf-btn-secondary hf-btn--compact w-fit disabled:opacity-50"
          >
            Træk valgte tilbage
          </button>
          <button
            type="submit"
            formAction={sendAllMatchingToScanApp}
            disabled={matchingTotal === 0}
            onClick={(event) => {
              if (!window.confirm(`Send alle ${matchingTotal} varer, der matcher filteret, til scan-appen?`)) event.preventDefault();
            }}
            className="hf-btn-secondary hf-btn--compact w-fit disabled:opacity-50"
          >
            Send alle {matchingTotal} (filteret) til scan-appen
          </button>
        </div>
      </div>

      {rows.length === 0 && <p className="hf-type-body py-4 text-text-secondary">Ingen varer matcher filtrene.</p>}

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.productId} className="hf-panel flex gap-3">
            {/* Afkrydsning sender id'et med formularen (name="ids"). */}
            <input
              type="checkbox"
              name="ids"
              value={row.productId}
              checked={selected.has(row.productId)}
              onChange={() => toggle(row.productId)}
              aria-label={`Vælg ${row.name}`}
              className="mt-1 h-5 w-5 flex-none"
            />
            {row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.imageUrl} alt="" className="h-16 w-16 flex-none rounded object-contain" />
            ) : (
              <div className="h-16 w-16 flex-none rounded bg-hf-tan" aria-hidden />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/admin/products/${row.productId}`} className="hf-type-body hf-type-strong text-hf-black underline">
                    {[row.brand, row.name, row.packageSizeText].filter(Boolean).join(" · ")}
                  </Link>
                  {row.barcode && <p className="hf-type-caption">Stregkode {row.barcode}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`hf-type-micro hf-type-strong rounded-full px-2 py-0.5 ${RATING_TONE[row.rating]}`}>
                    {OFF_QUALITY_RATING_LABELS[row.rating]} · {row.score}/100
                  </span>
                  <ScanStatus row={row} />
                </div>
              </div>
              {row.groups.length === 0 ? (
                <p className="hf-type-caption">Intet at udsætte.</p>
              ) : (
                <dl className="flex flex-col gap-1">
                  {row.groups.map((group) => (
                    <div key={group.label} className="hf-type-small">
                      <dt className="hf-type-strong inline">{group.label}: </dt>
                      <dd className="inline text-text-secondary">{group.comments.join(" ")}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </li>
        ))}
      </ul>
    </form>
  );
}

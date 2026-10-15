"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideRecheckAction } from "@/app/admin/products/recheck-actions";
import { RECHECK_FIELD_LABELS, type RecheckField, type RecheckValues } from "@/lib/product-recheck-rules";

// Ét 2-års tjek (docs/DECISIONS.md 2026-10-15): originalen og det nye foto
// side om side. Det nyeste er valgt som standard; billedet fritlægges først,
// når admin har sagt ja.
export type RecheckCardItem = {
  id: string;
  productId: string;
  productName: string;
  brand: string | null;
  barcode: string | null;
  productCreatedLabel: string;
  scannedLabel: string;
  originalImageUrl: string | null;
  frontPhotoUrl: string;
  nutritionPhotoUrl: string | null;
  ingredientsPhotoUrl: string | null;
  imageChanged: boolean | null;
  imageNote: string | null;
  changedFields: RecheckField[];
  original: RecheckValues;
  read: RecheckValues;
  error: string | null;
};

function formatValue(field: RecheckField, values: RecheckValues): string {
  const value = values[field];
  if (value == null || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString("da-DK", { maximumFractionDigits: 1 });
  return value;
}

function Choice({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="hf-type-body flex cursor-pointer items-center gap-2">
      <input type="radio" className="hf-native-choice" name={name} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

export function RecheckCard({ item }: { item: RecheckCardItem }) {
  const router = useRouter();
  const [useNewImage, setUseNewImage] = useState(item.imageChanged !== false);
  const [useNewData, setUseNewData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const hasDataChanges = item.changedFields.length > 0;

  async function save() {
    setSaving(true);
    const result = await decideRecheckAction(item.id, useNewImage, hasDataChanges && useNewData);
    setMessage(result.message);
    setSaving(false);
    if (result.ok) router.refresh();
  }

  return (
    <div className="hf-surface flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a href={`/admin/products/${item.productId}`} className="min-w-0 hover:opacity-80">
          <p className="hf-type-strong truncate text-hf-black">
            {item.brand && <span>{item.brand} </span>}
            {item.productName}
          </p>
          <p className="hf-type-small text-text-muted">
            {item.barcode ?? "Ingen stregkode"} · oprettet {item.productCreatedLabel} · scannet {item.scannedLabel}
          </p>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Original", url: item.originalImageUrl, active: !useNewImage },
          { label: "Nyt foto", url: item.frontPhotoUrl, active: useNewImage },
        ].map((image) => (
          <figure key={image.label} className={`flex flex-col gap-2 rounded-lg p-2 ${image.active ? "hf-selected" : "border border-hf-tan-dark"}`}>
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-hf-tan">
              {image.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.url} alt={image.label} className="h-full w-full object-contain" />
              ) : (
                <span className="hf-type-small text-text-muted">Intet billede</span>
              )}
            </div>
            <figcaption className="hf-type-caption text-center">{image.label}</figcaption>
          </figure>
        ))}
      </div>
      {item.imageNote && <p className="hf-type-small text-text-secondary">AI: {item.imageNote}</p>}
      <div className="flex flex-wrap gap-4">
        <Choice name={`image-${item.id}`} checked={useNewImage} onChange={() => setUseNewImage(true)} label="Brug det nye foto (fritlægges i nat)" />
        <Choice name={`image-${item.id}`} checked={!useNewImage} onChange={() => setUseNewImage(false)} label="Behold originalen" />
      </div>

      {hasDataChanges && (
        <div className="flex flex-col gap-2">
          <table className="hf-type-small w-full">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="hf-type-small py-1 pr-2">Felt</th>
                <th className="hf-type-small py-1 pr-2">Original</th>
                <th className="hf-type-small py-1">Nyt</th>
              </tr>
            </thead>
            <tbody>
              {item.changedFields.map((field) => (
                <tr key={field} className="border-t border-hf-tan-dark align-top">
                  <td className="py-1 pr-2">{RECHECK_FIELD_LABELS[field]}</td>
                  <td className="whitespace-pre-line py-1 pr-2">{formatValue(field, item.original)}</td>
                  <td className="whitespace-pre-line py-1">{formatValue(field, item.read)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-3">
            {[item.nutritionPhotoUrl, item.ingredientsPhotoUrl].filter(Boolean).map((url) => (
              <a key={url} href={url as string} target="_blank" rel="noreferrer" className="hf-btn-text">
                {url === item.nutritionPhotoUrl ? "Se energi-fotoet" : "Se indholds-fotoet"}
              </a>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <Choice name={`data-${item.id}`} checked={useNewData} onChange={() => setUseNewData(true)} label="Brug de nye værdier" />
            <Choice name={`data-${item.id}`} checked={!useNewData} onChange={() => setUseNewData(false)} label="Behold de gamle" />
          </div>
        </div>
      )}
      {item.error && <p className="hf-type-small text-hf-warning">{item.error}</p>}

      <div className="flex items-center justify-end gap-3">
        {message && <span className="hf-type-small text-text-muted">{message}</span>}
        <button type="button" onClick={() => void save()} disabled={saving} className="hf-btn-brand hf-btn--compact hf-btn--inline">
          Gem afgørelse
        </button>
      </div>
    </div>
  );
}

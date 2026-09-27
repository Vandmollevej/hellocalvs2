"use client";

import { useRef } from "react";
import { IconCamera, IconToolsKitchen2, IconX } from "@tabler/icons-react";
import { fileToDownscaledDataUrl } from "@/lib/image-downscale";

// Indholdet i de foldbare sektioner på en opskrift i HelloFresh-stil.

export type RecipeIngredientItem = { key: string; name: string; amount: string; imageUrl: string | null };

export function RecipeIngredientList({ items }: { items: RecipeIngredientItem[] }) {
  return (
    <div className="rv-ingredients">
      {items.map((item) => (
        <div key={item.key} className="rv-ingredient">
          {item.imageUrl ? (
            <div className="rv-ingredient-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" />
            </div>
          ) : (
            <div className="rv-ingredient-image rv-ingredient-placeholder">
              <IconToolsKitchen2 size={20} stroke={1.75} />
            </div>
          )}
          <div className="min-w-0">
            <p className="rv-ingredient-name">{item.name}</p>
            {item.amount && <p className="rv-ingredient-amount">{item.amount}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecipeStepList({ steps }: { steps: string[] }) {
  return (
    <ol className="rv-steps">
      {steps.map((step, index) => (
        <li key={index} className="rv-step">
          <span className="rv-step-number">{index + 1}</span>
          <p className="rv-step-text">{step}</p>
        </li>
      ))}
    </ol>
  );
}

export function RecipeNutritionTable({ rows }: { rows: { key: string; label: string; value: string }[] }) {
  return (
    <dl className="rv-nutrition">
      {rows.map((row) => (
        <div key={row.key} className="rv-nutrition-row">
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RecipeCookbookPhotos({
  photos,
  addLabel,
  removeLabel,
  canAdd,
  onAdd,
  onRemove,
}: {
  photos: { id: string; image: string }[];
  addLabel: string;
  removeLabel: string;
  canAdd: boolean;
  onAdd: (image: string) => void;
  onRemove: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const image = await fileToDownscaledDataUrl(file).catch(() => null);
    if (image) onAdd(image);
  }

  return (
    <>
      {photos.length > 0 && (
        <div className="rv-photos">
          {photos.map((photo) => (
            <div key={photo.id} className="rv-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.image} alt="" />
              <button
                type="button"
                className="rv-photo-remove rv-no-print"
                aria-label={removeLabel}
                onClick={() => onRemove(photo.id)}
              >
                <IconX size={16} stroke={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}
      {canAdd && (
        <>
          <button
            type="button"
            className="rv-outline-button rv-outline-button--block rv-no-print"
            onClick={() => fileRef.current?.click()}
          >
            <IconCamera size={22} stroke={2} />
            {addLabel}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              void pick(event.target.files);
              event.target.value = "";
            }}
          />
        </>
      )}
    </>
  );
}

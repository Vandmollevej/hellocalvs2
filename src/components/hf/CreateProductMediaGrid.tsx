"use client";

import { IconClipboardText, IconList, IconPhoto } from "@tabler/icons-react";
import { NumberedBadge } from "@/components/hf/NumberedBadge";
import { HfBarcodeIcon } from "@/components/hf/HfBarcodeIcon";

export type MediaGridValue = {
  barcodeImage?: string;
  barcodeValue: string;
  nutritionImage?: string;
  ingredientsImage?: string;
  mainImage?: string;
  sideImages: [string?, string?, string?];
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function MediaBox({
  number,
  label,
  image,
  icon,
  onPick,
}: {
  number: number;
  label: string;
  image?: string;
  icon: React.ReactNode;
  onPick: (file: File) => void;
}) {
  return (
    <label
      className="relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[12px]"
      style={{ background: "var(--hf-color-card)" }}
    >
      <NumberedBadge number={number} />
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={label} className="h-full w-full object-cover" />
      ) : (
        <>
          <span style={{ color: "var(--hf-color-action)" }}>{icon}</span>
          <span className="hf-type-caption px-2 text-center">{label}</span>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
        }}
      />
    </label>
  );
}

function ImageSubCell({
  label,
  image,
  onPick,
}: {
  label: string;
  image?: string;
  onPick: (file: File) => void;
}) {
  return (
    <label
      className="relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[6px]"
      style={{ background: "var(--hf-color-surface)" }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={label} className="h-full w-full object-cover" />
      ) : (
        <IconPhoto size={18} stroke={1.75} style={{ color: "var(--hf-color-inactive)" }} />
      )}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
        }}
      />
    </label>
  );
}

// design.md §6.11 — statisk 2×2-grid under produkt-masterdata: stregkode,
// næringsindhold, indholdsfortegnelse og produktbilleder. Hver boks er
// nummereret 1-4 og erstattes af brugerens beskårne foto, når ét findes
// (fra kamera-auto-flowet eller manuel filvalg her).
export function CreateProductMediaGrid({
  value,
  onChange,
}: {
  value: MediaGridValue;
  onChange: (next: MediaGridValue) => void;
}) {
  async function setField(key: "barcodeImage" | "nutritionImage" | "ingredientsImage" | "mainImage", file: File) {
    onChange({ ...value, [key]: await readAsDataUrl(file) });
  }

  async function setSideImage(index: 0 | 1 | 2, file: File) {
    const sideImages = [...value.sideImages] as [string?, string?, string?];
    sideImages[index] = await readAsDataUrl(file);
    onChange({ ...value, sideImages });
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <MediaBox
        number={1}
        label="Stregkode"
        image={value.barcodeImage}
        icon={<HfBarcodeIcon />}
        onPick={(file) => setField("barcodeImage", file)}
      />
      <MediaBox
        number={2}
        label="Næringsindhold"
        image={value.nutritionImage}
        icon={<IconClipboardText size={32} stroke={1.75} />}
        onPick={(file) => setField("nutritionImage", file)}
      />
      <MediaBox
        number={3}
        label="Indholdsfortegnelse"
        image={value.ingredientsImage}
        icon={<IconList size={32} stroke={1.75} />}
        onPick={(file) => setField("ingredientsImage", file)}
      />
      <div className="relative aspect-square rounded-[12px] p-1.5" style={{ background: "var(--hf-color-card)" }}>
        <NumberedBadge number={4} />
        <div className="grid h-full grid-cols-2 gap-1.5">
          <ImageSubCell label="Hovedbillede" image={value.mainImage} onPick={(file) => setField("mainImage", file)} />
          <ImageSubCell label="Sidebillede 1" image={value.sideImages[0]} onPick={(file) => setSideImage(0, file)} />
          <ImageSubCell label="Sidebillede 2" image={value.sideImages[1]} onPick={(file) => setSideImage(1, file)} />
          <ImageSubCell label="Sidebillede 3" image={value.sideImages[2]} onPick={(file) => setSideImage(2, file)} />
        </div>
      </div>
    </div>
  );
}

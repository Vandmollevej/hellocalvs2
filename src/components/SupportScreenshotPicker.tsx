"use client";

import { useRef, useState } from "react";
import { IconPhotoPlus, IconX } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";

const MAX_IMAGES = 3;
const MAX_EDGE = 1600;

// Skalerer til højst 1600 px og genkoder som JPEG. Genkodningen fjerner også
// EXIF/GPS, før billedet forlader telefonen (docs/PRIVACY.md).
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Skærmbilleder til en supportbesked (docs/DECISIONS.md 2026-09-26).
export function SupportScreenshotPicker({
  images,
  onChange,
  disabled,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(false);

  async function add(files: FileList | null) {
    if (!files) return;
    setError(false);
    const next = [...images];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_IMAGES) break;
      try {
        next.push(await compressImage(file));
      } catch {
        setError(true);
      }
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {images.map((src, index) => (
          <div key={index} className="relative h-20 w-20 overflow-hidden rounded-[8px] bg-hf-tan">
            {/* eslint-disable-next-line @next/next/no-img-element -- lokal data-URL, ingen optimering mulig */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={t("settings.support.removeAttachment")}
              onClick={() => onChange(images.filter((_, i) => i !== index))}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-hf-black text-hf-white"
            >
              <IconX size={14} stroke={2.5} />
            </button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-hf-black disabled:opacity-50"
            aria-label={t("settings.support.attachScreenshots")}
          >
            <IconPhotoPlus size={24} stroke={1.75} />
          </button>
        )}
      </div>
      <p className="hf-type-caption opacity-60">{t("settings.support.attachHint")}</p>
      {error && (
        <p role="alert" className="hf-type-caption text-hf-red-dark">
          {t("settings.support.attachmentError")}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => add(event.target.files)}
      />
    </div>
  );
}

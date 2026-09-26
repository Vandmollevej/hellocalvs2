"use client";

import { useRef } from "react";
import { IconCamera, IconX } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { fileToDownscaledDataUrl } from "@/lib/image-downscale";
import { MAX_RECIPE_IMAGES } from "@/lib/recipe-categories";

// Op til 3 billeder af den færdige ret (docs/DECISIONS.md 2026-09-25).
// Det første billede er rettens forsidebillede i listerne.
export function RecipeImagesPicker({
  images,
  onChange,
}: {
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  async function add(files: FileList | null) {
    if (!files) return;
    const room = MAX_RECIPE_IMAGES - images.length;
    const picked = await Promise.all(
      Array.from(files)
        .slice(0, room)
        .map((file) => fileToDownscaledDataUrl(file).catch(() => null)),
    );
    onChange([...images, ...picked.filter((image): image is string => image !== null)]);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((image, index) => (
        <div key={index} className="relative aspect-square overflow-hidden rounded-[8px] bg-hf-tan">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(images.filter((_, i) => i !== index))}
            aria-label={t("recipeImages.remove")}
            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-hf-white text-hf-black"
          >
            <IconX size={14} />
          </button>
        </div>
      ))}
      {images.length < MAX_RECIPE_IMAGES && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={t("recipeImages.add")}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[8px] bg-hf-tan text-hf-black"
        >
          <IconCamera size={24} />
          <span className="text-[11px] opacity-70">
            {t("recipeImages.count", { count: images.length, max: MAX_RECIPE_IMAGES })}
          </span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          void add(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

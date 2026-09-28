"use client";

import { useEffect, useState } from "react";
import type { ObjectBox } from "@/lib/object-picker";
import { useTranslation } from "@/i18n/LocaleProvider";

// Grønne cirkler om hvert muligt objekt i det tagne billede. Lægges oven på
// billedet i en beholder med `object-cover`; SVG'ens "slice" beskærer på samme
// måde, så cirklerne sidder præcis over objekterne.
export function ObjectPickerOverlay({
  photo,
  objects,
  onPick,
  onUseWhole,
}: {
  photo: string;
  objects: ObjectBox[];
  onPick: (object: ObjectBox) => void;
  onUseWhole: () => void;
}) {
  const { t } = useTranslation();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setSize({ w: image.naturalWidth, h: image.naturalHeight });
    };
    image.src = photo;
    return () => {
      cancelled = true;
    };
  }, [photo]);

  return (
    <div className="absolute inset-0">
      {size && (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="xMidYMid slice"
        >
          {objects.map((object, index) => {
            const cx = (object.x + object.width / 2) * size.w;
            const cy = (object.y + object.height / 2) * size.h;
            const r = (Math.max(object.width * size.w, object.height * size.h) / 2) * 1.05;
            const stroke = Math.max(size.w, size.h) * 0.006;
            return (
              <g
                key={index}
                role="button"
                tabIndex={0}
                aria-label={t("camera.pickObjectAria", { name: object.label || `${index + 1}` })}
                className="cursor-pointer"
                onClick={() => onPick(object)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onPick(object);
                }}
              >
                <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="var(--hf-green-light)" strokeWidth={stroke} />
                <circle cx={cx} cy={cy} r={stroke * 2.2} fill="var(--hf-green-light)" />
              </g>
            );
          })}
        </svg>
      )}
      <p className="hf-type-small hf-type-strong pointer-events-none absolute inset-x-4 top-4 rounded-full bg-hf-black/60 px-4 py-2 text-center text-hf-white">
        {t("camera.pickObjectHint")}
      </p>
      <button
        type="button"
        onClick={onUseWhole}
        className="hf-type-small hf-type-strong absolute inset-x-4 bottom-4 rounded-full bg-hf-black/60 px-4 py-2 text-center text-hf-white"
      >
        {t("camera.useWholePhoto")}
      </button>
    </div>
  );
}

"use client";

import { useTranslation } from "@/i18n/LocaleProvider";
import {
  formatHandSizeDimensions,
  handSizeImageScale,
  type HandSizeItem,
  type HandSizeKey,
} from "@/lib/hand-sizes";

// Billedhøjden for "Stor" — bevidst større end de 46–56 px, vandsidens
// beholdere bruger. "Lille" og "Normal" skaleres lineært efter hel vægt
// (src/lib/hand-sizes.ts), og alle står på samme bundlinje.
const LARGEST_IMAGE_PX = 76;

const LABEL_KEY: Record<HandSizeKey, "addProduct.sizeSmall" | "addProduct.sizeMedium" | "addProduct.sizeLarge"> = {
  small: "addProduct.sizeSmall",
  medium: "addProduct.sizeMedium",
  large: "addProduct.sizeLarge",
};

// Lille / Normal / Stor for håndfrugt og æg, største til højre — samme
// flise-mønster som vandsidens beholdere. Et tryk sætter mængden til ét stk.
// i den størrelse: den spiselige vægt sættes i mængdeboksen, og kalorierne
// følger med.
export function HandSizePicker({
  item,
  imageUrl,
  amount,
  onSelect,
}: {
  item: HandSizeItem;
  imageUrl: string | null;
  amount: number;
  onSelect: (grams: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div role="group" aria-label={t("addProduct.sizeLabel")} className="mx-auto mb-4 grid w-full max-w-[320px] grid-cols-3 gap-2">
      {item.sizes.map((size) => {
        const isSelected = Math.round(amount) === size.grams;
        const imageHeight = Math.round(LARGEST_IMAGE_PX * handSizeImageScale(size, item));
        return (
          <button
            key={size.key}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(size.grams)}
            className={`flex flex-col items-center justify-end gap-1 rounded-2xl px-1 py-3 transition-colors ${
              isSelected ? "hf-selected" : "bg-hf-tan text-hf-black"
            }`}
          >
            {imageUrl && (
              <span className="flex w-full items-end justify-center" style={{ height: LARGEST_IMAGE_PX }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="block w-auto max-w-full object-contain"
                  style={{ height: imageHeight }}
                />
              </span>
            )}
            <span className="hf-type-small hf-type-strong">{t(LABEL_KEY[size.key])}</span>
            <span className="hf-type-micro">{formatHandSizeDimensions(size)}</span>
            {/* Hel vægt som på køkkenvægten; den spiselige del er den, der
                registreres i mængdeboksen. */}
            <span className="hf-type-micro hf-type-strong">{size.wholeGrams} g</span>
            {size.grams !== size.wholeGrams && (
              <span className="hf-type-micro text-center">
                {`${size.grams} g ${t(`addProduct.refuse.${item.refuseKey}`)}`}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

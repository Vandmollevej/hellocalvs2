"use client";

import { useState } from "react";
import { IconClipboardText, IconList, IconPhoto } from "@tabler/icons-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NumberedBadge } from "@/components/hf/NumberedBadge";
import { HfBarcodeIcon } from "@/components/hf/HfBarcodeIcon";
import { extractText, hasMeaningfulText, parseNutritionText, type ParsedNutrition } from "@/lib/product-ocr";
import { regionToOcrLanguage } from "@/lib/regions";
import { useTranslation } from "@/i18n/LocaleProvider";

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

type BoxStatus = "idle" | "working" | "failed";

function MediaBox({
  number,
  label,
  image,
  icon,
  status,
  workingLabel,
  failedLabel,
  onPick,
}: {
  number: number;
  label: string;
  image?: string;
  icon: React.ReactNode;
  status: BoxStatus;
  workingLabel: string;
  failedLabel: string;
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
      {status === "working" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-2 text-center">
          <span className="hf-type-caption text-white">{workingLabel}</span>
        </div>
      )}
      {status === "failed" && (
        <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1 text-center">
          <span className="hf-type-caption text-white">{failedLabel}</span>
        </div>
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
//
// Boks 1-3 udtrækker nu selv data af det valgte billede (docs/DECISIONS.md
// 2026-09-12): stregkode afkodes altid lokalt/gratis med ZXing (AI er
// markant mindre pålidelig til at læse et præcist stregmønster korrekt, så
// den bruges slet ikke her — brugeren retter selv i feltet nedenfor, hvis
// afkodningen fejler); næring genbruger det eksisterende "lokal regex først,
// AI kun som fallback"-mønster fra /camera/create; ingredienser køres altid
// igennem lokal OCR først, og AI'ens ENESTE rolle er at oversætte den fundne
// tekst til appens UI-sprog — den må aldrig selv genkende/gætte ingredienser.
export function CreateProductMediaGrid({
  value,
  onChange,
  region,
  uiLang,
  onNutritionExtracted,
  onIngredientsExtracted,
}: {
  value: MediaGridValue;
  onChange: (next: MediaGridValue) => void;
  region: string;
  uiLang: "da" | "en";
  onNutritionExtracted: (values: ParsedNutrition) => void;
  onIngredientsExtracted: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [barcodeStatus, setBarcodeStatus] = useState<BoxStatus>("idle");
  const [nutritionStatus, setNutritionStatus] = useState<BoxStatus>("idle");
  const [ingredientsStatus, setIngredientsStatus] = useState<BoxStatus>("idle");

  async function setSideImage(index: 0 | 1 | 2, file: File) {
    const sideImages = [...value.sideImages] as [string?, string?, string?];
    sideImages[index] = await readAsDataUrl(file);
    onChange({ ...value, sideImages });
  }

  async function setMainImage(file: File) {
    onChange({ ...value, mainImage: await readAsDataUrl(file) });
  }

  async function pickBarcodeImage(file: File) {
    const dataUrl = await readAsDataUrl(file);
    setBarcodeStatus("working");
    let barcodeValue = value.barcodeValue;
    try {
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(dataUrl);
      barcodeValue = result.getText();
      setBarcodeStatus("idle");
    } catch {
      // ZXing kunne ikke afkode billedet (sløret/vinklet/intet stregkode-
      // mønster fundet) — den eksisterende manuelle stregkode-tekstfelt
      // forbliver brugerens fallback. Ingen AI-fallback her med vilje.
      setBarcodeStatus("failed");
    }
    onChange({ ...value, barcodeImage: dataUrl, barcodeValue });
  }

  async function pickNutritionImage(file: File) {
    const dataUrl = await readAsDataUrl(file);
    setNutritionStatus("working");
    try {
      const ocrText = await extractText(dataUrl, regionToOcrLanguage(region));
      let parsed = parseNutritionText(ocrText);

      if (!parsed) {
        const aiRes = await fetch("/api/ai/extract-nutrition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo: dataUrl }),
        });
        const aiData = (await aiRes.json()) as { values: Record<string, number | null> | null };
        const v = aiData.values;
        if (v && v.kcalPer100g != null && v.proteinPer100g != null && v.carbsPer100g != null && v.fatPer100g != null) {
          parsed = {
            kcalPer100g: v.kcalPer100g,
            proteinPer100g: v.proteinPer100g,
            carbsPer100g: v.carbsPer100g,
            fatPer100g: v.fatPer100g,
          };
        }
      }

      if (parsed) {
        onNutritionExtracted(parsed);
        setNutritionStatus("idle");
      } else {
        setNutritionStatus("failed");
      }
    } catch {
      setNutritionStatus("failed");
    }
    onChange({ ...value, nutritionImage: dataUrl });
  }

  async function pickIngredientsImage(file: File) {
    const dataUrl = await readAsDataUrl(file);
    setIngredientsStatus("working");
    try {
      const ocrLang = regionToOcrLanguage(region);
      const ocrText = await extractText(dataUrl, ocrLang);
      if (hasMeaningfulText(ocrText)) {
        const cleaned = ocrText.replace(/\s+/g, " ").trim();
        const primarySource = ocrLang.split("+")[0];
        const sourceIsUiLang =
          (primarySource === "dan" && uiLang === "da") || (primarySource === "eng" && uiLang === "en");

        if (sourceIsUiLang) {
          onIngredientsExtracted(cleaned);
          setIngredientsStatus("idle");
        } else {
          const res = await fetch("/api/ai/extract-ingredients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: cleaned, targetLang: uiLang }),
          });
          const data = (await res.json()) as { text: string | null };
          onIngredientsExtracted(data.text ?? cleaned);
          setIngredientsStatus(data.text ? "idle" : "failed");
        }
      } else {
        setIngredientsStatus("failed");
      }
    } catch {
      setIngredientsStatus("failed");
    }
    onChange({ ...value, ingredientsImage: dataUrl });
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <MediaBox
        number={1}
        label={t("productCreate.mediaBarcode")}
        image={value.barcodeImage}
        icon={<HfBarcodeIcon />}
        status={barcodeStatus}
        workingLabel={t("productCreate.mediaScanningBarcode")}
        failedLabel={t("productCreate.mediaScanFailedBarcode")}
        onPick={pickBarcodeImage}
      />
      <MediaBox
        number={2}
        label={t("productCreate.mediaNutrition")}
        image={value.nutritionImage}
        icon={<IconClipboardText size={32} stroke={1.75} />}
        status={nutritionStatus}
        workingLabel={t("productCreate.mediaScanningNutrition")}
        failedLabel={t("productCreate.mediaScanFailedNutrition")}
        onPick={pickNutritionImage}
      />
      <MediaBox
        number={3}
        label={t("productCreate.mediaIngredients")}
        image={value.ingredientsImage}
        icon={<IconList size={32} stroke={1.75} />}
        status={ingredientsStatus}
        workingLabel={t("productCreate.mediaScanningIngredients")}
        failedLabel={t("productCreate.mediaScanFailedIngredients")}
        onPick={pickIngredientsImage}
      />
      <div className="relative aspect-square rounded-[12px] p-1.5" style={{ background: "var(--hf-color-card)" }}>
        <NumberedBadge number={4} />
        <div className="grid h-full grid-cols-2 gap-1.5">
          <ImageSubCell label={t("productCreate.mediaMainImage")} image={value.mainImage} onPick={setMainImage} />
          <ImageSubCell label={t("productCreate.mediaSideImage1")} image={value.sideImages[0]} onPick={(file) => setSideImage(0, file)} />
          <ImageSubCell label={t("productCreate.mediaSideImage2")} image={value.sideImages[1]} onPick={(file) => setSideImage(1, file)} />
          <ImageSubCell label={t("productCreate.mediaSideImage3")} image={value.sideImages[2]} onPick={(file) => setSideImage(2, file)} />
        </div>
      </div>
    </div>
  );
}

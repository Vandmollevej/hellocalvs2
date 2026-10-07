"use client";

import { useRef, useState } from "react";
import { IconCamera, IconPhoto, IconX } from "@tabler/icons-react";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { SkeletonMediaRows, SkeletonScreen } from "@/components/hf/Skeleton";
import { useTranslation } from "@/i18n/LocaleProvider";
import { fileToDownscaledDataUrl } from "@/lib/image-downscale";
import { hasMeaningfulText } from "@/lib/product-ocr";

// "Indsæt tekst" og "Scan" under Retter → Opret ret (brugerens krav
// 2026-10-07). Begge ender i samme resultat: serverens tekst-robot
// (/api/dishes/parse-text) har fundet titel, antal personer, ingredienser,
// trin og næringstabel, og opret-ret-siden indsætter dem.

export type ImportedIngredient = {
  raw: string;
  name: string;
  grams: number | null;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    kcalPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
  } | null;
};

export type ImportResult = {
  title: string;
  servings: number | null;
  steps: string[];
  nutrition: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; perServing: boolean } | null;
  ingredients: ImportedIngredient[];
  image: string | null;
  // Scan: sidebillederne i rækkefølge; billede 2, 3 … sættes ind ved trinene.
  pageImages?: string[];
};

async function parseText(text: string, sourceUrl?: string): Promise<ImportResult> {
  const res = await fetch("/api/dishes/parse-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sourceUrl: sourceUrl || undefined }),
  });
  if (!res.ok) throw new Error("parse");
  return (await res.json()) as ImportResult;
}

export function PasteTextSheet({ onClose, onResult }: { onClose: () => void; onResult: (result: ImportResult) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);

  async function insert() {
    setWorking(true);
    setError(false);
    try {
      onResult(await parseText(text, sourceUrl.trim()));
      onClose();
    } catch {
      setError(true);
      setWorking(false);
    }
  }

  return (
    <BottomSheet
      size="full"
      title={t("createDish.pasteTitle")}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={insert}
          disabled={working || !text.trim()}
          className="hf-control hf-btn-primary w-full disabled:opacity-60"
        >
          {working ? t("createDish.pasteWorking") : t("createDish.pasteInsert")}
        </button>
      }
    >
      <div className="hf-page">
        {working ? (
          <SkeletonScreen className="">
            <SkeletonMediaRows rows={5} />
          </SkeletonScreen>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("createDish.pastePlaceholder")}
              rows={12}
              autoFocus
              className="hf-type-body w-full rounded-2xl bg-hf-tan p-4 text-hf-black outline-none"
            />
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              inputMode="url"
              autoComplete="off"
              placeholder={t("createDish.pasteSourcePlaceholder")}
              className="hf-type-body hf-field min-w-0 rounded-full bg-hf-tan px-4 text-hf-black outline-none"
            />
            {error && <p className="hf-type-body text-text-secondary text-center">{t("createDish.pasteError")}</p>}
          </>
        )}
      </div>
    </BottomSheet>
  );
}

// Telefonens egen OCR først: høj sikkerhed = trykt tekst, som læses lokalt.
// Lav sikkerhed = håndskrift, som sendes direkte til OpenAI (serveren).
async function readPage(image: string): Promise<string> {
  try {
    const { recognize } = await import("tesseract.js");
    const result = await recognize(image, "dan+eng");
    const text = result.data.text ?? "";
    if (result.data.confidence >= 60 && hasMeaningfulText(text) && text.trim().length > 40) return text;
  } catch {
    // Lokal OCR kunne ikke køre: behandl siden som håndskrift.
  }
  const res = await fetch("/api/dishes/ocr-handwriting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  if (!res.ok) throw new Error("ocr");
  return String(((await res.json()) as { text?: string }).text ?? "");
}

export function ScanSheet({ onClose, onResult }: { onClose: () => void; onResult: (result: ImportResult) => void }) {
  const { t } = useTranslation();
  const [pages, setPages] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const added: string[] = [];
    for (const file of Array.from(files)) added.push(await fileToDownscaledDataUrl(file, 1800, 0.85));
    setPages((current) => [...current, ...added]);
  }

  // Siderne læses kronologisk, og teksten samles i den rækkefølge.
  async function finish() {
    setWorking(true);
    setError(false);
    try {
      const texts: string[] = [];
      for (const page of pages) texts.push(await readPage(page));
      const result = await parseText(texts.join("\n\n"));
      // Første billede er rettens billede øverst; de øvrige hører til trinene.
      onResult({ ...result, image: pages[0] ?? null, pageImages: pages.slice(1) });
      onClose();
    } catch {
      setError(true);
      setWorking(false);
    }
  }

  return (
    <BottomSheet
      size="full"
      title={t("createDish.scanTitle")}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={finish}
          disabled={working || pages.length === 0}
          className="hf-control hf-btn-primary w-full disabled:opacity-60"
        >
          {working ? t("createDish.scanWorking") : t("createDish.scanFinish")}
        </button>
      }
    >
      <div className="hf-page">
        {working ? (
          <SkeletonScreen className="">
            <SkeletonMediaRows rows={5} />
          </SkeletonScreen>
        ) : (
          <>
            <p className="hf-type-small text-text-secondary">{t("createDish.scanHint")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-2xl bg-hf-tan py-3 text-center"
              >
                <IconCamera size={20} color="var(--hf-black)" />
                <span className="hf-type-small hf-type-strong text-hf-black">{t("createDish.scanTake")}</span>
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-2xl bg-hf-tan py-3 text-center"
              >
                <IconPhoto size={20} color="var(--hf-black)" />
                <span className="hf-type-small hf-type-strong text-hf-black">{t("createDish.scanGallery")}</span>
              </button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            {pages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {pages.map((page, index) => (
                  <div key={index} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-hf-tan">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={page} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPages((current) => current.filter((_, i) => i !== index))}
                      aria-label={t("createDish.removeIngredient")}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-hf-white text-hf-black"
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {error && <p className="hf-type-body text-text-secondary text-center">{t("createDish.scanError")}</p>}
          </>
        )}
      </div>
    </BottomSheet>
  );
}

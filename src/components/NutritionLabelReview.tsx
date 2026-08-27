"use client";

import type { NutritionFields } from "@/lib/nutrition-ocr";

type Props = {
  ocrStatus: "processing" | "done" | "failed";
  fields: NutritionFields;
  onUseValues: () => void;
  onRetake: () => void;
};

const hasAnyValue = (fields: NutritionFields) =>
  fields.kcalPer100g != null || fields.proteinPer100g != null || fields.carbsPer100g != null || fields.fatPer100g != null;

export function NutritionLabelReview({ ocrStatus, fields, onUseValues, onRetake }: Props) {
  return (
    <div className="rounded-2xl bg-hf-tan p-4">
      {ocrStatus === "processing" && (
        <p className="mb-3 text-xs text-hf-black opacity-70">Læser næringsdeklarationen...</p>
      )}
      {ocrStatus === "done" && hasAnyValue(fields) && (
        <p className="mb-3 text-xs text-hf-black opacity-70">
          Værdierne blev læst automatisk. Du kan tjekke og rette dem på næste skærm, før produktet oprettes.
        </p>
      )}
      {(ocrStatus === "failed" || (ocrStatus === "done" && !hasAnyValue(fields))) && (
        <p className="mb-3 text-xs font-semibold text-hf-black">
          Kunne ikke aflæse — indtast værdierne manuelt på næste skærm.
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onRetake} className="hf-btn-secondary flex-1 py-2.5 text-xs">
          Tag billedet om
        </button>
        <button
          type="button"
          onClick={onUseValues}
          disabled={ocrStatus === "processing"}
          className="hf-btn-primary flex-1 py-2.5 text-xs disabled:opacity-40"
        >
          Opret produkt
        </button>
      </div>
    </div>
  );
}

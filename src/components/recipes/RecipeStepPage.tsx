"use client";

import { useRef, useState } from "react";
import { IconCamera, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { fileToDownscaledDataUrl } from "@/lib/image-downscale";
import type { StepDraft } from "@/components/recipes/RecipeStepsEditor";

// Ét trin af fremgangsmåden på sin egen side i Opret ret-flowet (helsides
// popup). Billedet lægges nederst; på web kan det også trækkes ind (drag and
// drop), på telefon åbner et tryk kameraet/galleriet.
export function RecipeStepPage({
  index,
  step,
  canRemove,
  onChange,
  onAddAfter,
  onRemove,
}: {
  index: number;
  step: StepDraft;
  canRemove: boolean;
  onChange: (step: StepDraft) => void;
  onAddAfter: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function pick(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const image = await fileToDownscaledDataUrl(file).catch(() => null);
    if (image) onChange({ ...step, image });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="hf-type-small hf-type-strong text-text-secondary">
          {t("recipeSteps.stepNumber", { number: index + 1 })}
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("recipeSteps.remove")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-hf-tan text-hf-black"
          >
            <IconTrash size={16} />
          </button>
        )}
      </div>
      <input
        value={step.title}
        onChange={(event) => onChange({ ...step, title: event.target.value })}
        placeholder={t("recipeSteps.titlePlaceholder")}
        aria-label={t("recipeSteps.titlePlaceholder")}
        className="hf-type-body hf-type-strong rounded-card bg-hf-tan px-3 py-2.5 text-hf-black outline-none"
      />
      <textarea
        value={step.text}
        onChange={(event) => onChange({ ...step, text: event.target.value })}
        placeholder={t("recipeSteps.textPlaceholder")}
        aria-label={t("recipeSteps.textPlaceholder")}
        rows={6}
        className="hf-type-body resize-none rounded-card bg-hf-tan px-3 py-2.5 text-hf-black outline-none"
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void pick(event.dataTransfer.files?.[0]);
        }}
        className={`relative flex min-h-32 items-center justify-center overflow-hidden rounded-card border-2 border-dashed ${
          dragOver
            ? "border-hf-black bg-hf-tan-dark"
            : "border-hf-tan-dark bg-hf-tan"
        }`}
      >
        {step.image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={step.image}
              alt=""
              className="max-h-56 w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange({ ...step, image: null })}
              aria-label={t("recipeSteps.removePhoto")}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-hf-white text-hf-black"
            >
              <IconX size={16} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={t("recipeSteps.addPhoto")}
            className="flex w-full flex-col items-center gap-2 px-4 py-6 text-center text-hf-black"
          >
            <IconCamera size={24} />
            <span className="hf-type-small text-text-secondary">
              {t("recipeSteps.dropPhoto")}
            </span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      <button
        type="button"
        onClick={onAddAfter}
        className="hf-control hf-btn-secondary flex w-full items-center justify-center gap-2"
      >
        <IconPlus size={18} />
        {t("recipeSteps.addStep")}
      </button>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { IconCamera, IconPlus, IconX } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { fileToDownscaledDataUrl } from "@/lib/image-downscale";

// Fremgangsmåde i Opret ret (docs/DECISIONS.md 2026-09-25): ét aktivt trin
// ad gangen (overskrift + tekst på redigerbar baggrund, kameraikon i siden).
// Plus gør trinnet statisk og åbner et nyt; tryk på et statisk trin for at
// rette det, × sletter det. Billedet vises som thumbnail ud for trinnet.

export type StepDraft = { title: string; text: string; image: string | null };

export const EMPTY_STEP: StepDraft = { title: "", text: "", image: null };

export function isEmptyStep(step: StepDraft) {
  return !step.title.trim() && !step.text.trim() && !step.image;
}

// `steps` indeholder altid det aktive trin (evt. tomt); tomme trin frasorteres
// først, når retten gemmes.
export function RecipeStepsEditor({
  steps,
  onChange,
}: {
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState(Math.max(0, steps.length - 1));
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const list = steps.length ? steps : [EMPTY_STEP];
  const draft = list[Math.min(active, list.length - 1)];

  function publish(current: StepDraft) {
    onChange(list.map((step, i) => (i === active ? current : step)));
  }

  // Fjerner det aktive trin, hvis det er tomt; returnerer listen og hvordan
  // et indeks efter det skal forskydes.
  function withoutEmptyActive() {
    if (!isEmptyStep(draft) || list.length === 1) return { next: list, shift: (i: number) => i };
    return { next: list.filter((_, i) => i !== active), shift: (i: number) => (i > active ? i - 1 : i) };
  }

  function commit() {
    if (isEmptyStep(draft)) return;
    const next = isEmptyStep(list[list.length - 1]) ? list : [...list, EMPTY_STEP];
    onChange(next);
    setActive(next.length - 1);
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  function edit(index: number) {
    const { next, shift } = withoutEmptyActive();
    onChange(next);
    setActive(shift(index));
  }

  function remove(index: number) {
    const next = list.filter((_, i) => i !== index);
    if (next.length === 0) {
      onChange([EMPTY_STEP]);
      setActive(0);
      return;
    }
    onChange(next);
    setActive(index < active ? active - 1 : Math.min(active, next.length - 1));
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    const image = await fileToDownscaledDataUrl(file).catch(() => null);
    if (image) publish({ ...draft, image });
  }

  function renderStatic(step: StepDraft, index: number) {
    return (
      <div key={index} className="flex items-start gap-3 border-b border-hf-tan-dark py-3">
        <button type="button" onClick={() => edit(index)} className="min-w-0 flex-1 text-left">
          <p className="hf-type-small hf-type-strong text-text-secondary">{t("recipeSteps.stepNumber", { number: index + 1 })}</p>
          {step.title && <p className="hf-type-body hf-type-strong text-hf-black">{step.title}</p>}
          {step.text && <p className="hf-type-small whitespace-pre-line text-hf-black">{step.text}</p>}
        </button>
        {step.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={step.image} alt="" className="h-12 w-12 shrink-0 rounded-[8px] object-cover" />
        )}
        <button
          type="button"
          onClick={() => remove(index)}
          aria-label={t("recipeSteps.remove")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hf-tan text-hf-black"
        >
          <IconX size={14} />
        </button>
      </div>
    );
  }

  const before = list.slice(0, active);
  const after = list.slice(active + 1);

  return (
    <div>
      {before.map((step, i) => (
        renderStatic(step, i)
      ))}

      <div className="my-4 flex gap-3 rounded-2xl bg-hf-tan p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="hf-type-small hf-type-strong text-text-secondary">
            {t("recipeSteps.stepNumber", { number: active + 1 })}
          </p>
          <input
            ref={titleRef}
            value={draft.title}
            onChange={(event) => publish({ ...draft, title: event.target.value })}
            placeholder={t("recipeSteps.titlePlaceholder")}
            aria-label={t("recipeSteps.titlePlaceholder")}
            className="hf-type-body hf-type-strong rounded-[8px] bg-hf-white px-3 py-2.5 text-hf-black outline-none"
          />
          <textarea
            value={draft.text}
            onChange={(event) => publish({ ...draft, text: event.target.value })}
            placeholder={t("recipeSteps.textPlaceholder")}
            aria-label={t("recipeSteps.textPlaceholder")}
            rows={4}
            className="hf-type-body resize-none rounded-[8px] bg-hf-white px-3 py-2.5 text-hf-black outline-none"
          />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2 pt-8">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={t("recipeSteps.addPhoto")}
            className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[8px] bg-hf-white text-hf-black"
          >
            {draft.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <IconCamera size={22} />
            )}
          </button>
          {draft.image && (
            <button
              type="button"
              onClick={() => publish({ ...draft, image: null })}
              aria-label={t("recipeSteps.removePhoto")}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-hf-white text-hf-black"
            >
              <IconX size={12} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              void pickImage(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {after.map((step, i) => (
        renderStatic(step, active + 1 + i)
      ))}

      <button
        type="button"
        onClick={commit}
        disabled={isEmptyStep(draft)}
        aria-label={t("recipeSteps.addStep")}
        className="mx-auto mt-1 flex h-11 w-11 items-center justify-center rounded-full bg-hf-black text-hf-white disabled:opacity-30"
      >
        <IconPlus size={22} />
      </button>
    </div>
  );
}

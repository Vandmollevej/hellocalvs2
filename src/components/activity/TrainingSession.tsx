"use client";

import { useMemo, useState } from "react";
import { IconBarbell, IconGymnastics, IconMinus, IconPlus, IconSearch, IconWeight, IconX } from "@tabler/icons-react";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { BottomSheet, useBottomSheetClose } from "@/components/hf/BottomSheet";
import { FieldSlider } from "@/components/hf/FieldSlider";
import { ProductImageCircle } from "@/components/ProductImageCircle";
import { RemoveCircleButton } from "@/components/ui/RemoveCircleButton";
import { useTranslation } from "@/i18n/LocaleProvider";
import { imageThumb } from "@/lib/image-thumb";
import {
  MAX_TRAINING_REPS,
  TRAINING_CATEGORIES,
  searchTrainingExercises,
  trainingExercise,
  trainingImage,
  trainingName,
  type TrainingCategory,
  type TrainingEntry,
} from "@/lib/training-exercises";

// Træningspas (bruger 2026-10-17) på Tilføj aktivitet: rækken øverst,
// øvelses-popuppen med billeder og søgning på dansk + engelsk, og et kort
// pr. øvelse med billedet som på en produktside og én bar pr. sæt
// (gentagelser på plus/minus, vægt på slider). Native: TrainingSession.kt.

const CATEGORY_ICONS: Record<TrainingCategory, typeof IconBarbell> = {
  machines: IconWeight,
  free_weights: IconBarbell,
  crossfit: IconGymnastics,
};

/** Største vægt på slideren pr. kategori (kg). */
const MAX_WEIGHT: Record<TrainingCategory, number> = { machines: 200, free_weights: 250, crossfit: 150 };

export function TrainingCategoryRows({ onPick }: { onPick: (category: TrainingCategory) => void }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="hf-type-section-title">{t("activity.training.title")}</h2>
      <AccordionCard>
        {TRAINING_CATEGORIES.map((category, index) => {
          const Icon = CATEGORY_ICONS[category];
          return (
            <ChevronRow
              key={category}
              icon={<Icon size={20} />}
              label={t(`activity.training.category.${category}`)}
              onClick={() => onPick(category)}
              divider={index < TRAINING_CATEGORIES.length - 1}
            />
          );
        })}
      </AccordionCard>
    </section>
  );
}

export function TrainingExerciseSheet({
  category,
  onPick,
  onClose,
}: {
  category: TrainingCategory;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet onClose={onClose} title={t(`activity.training.category.${category}`)} size="full">
      <ExerciseList category={category} onPick={onPick} />
    </BottomSheet>
  );
}

function ExerciseList({ category, onPick }: { category: TrainingCategory; onPick: (key: string) => void }) {
  const { t, locale } = useTranslation();
  const close = useBottomSheetClose();
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchTrainingExercises(category, query), [category, query]);
  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <div className="hf-search">
        <IconSearch size={16} color="var(--hf-black)" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("activity.training.search")}
          aria-label={t("activity.training.search")}
        />
      </div>
      {matches.length === 0 ? (
        <p className="hf-type-body text-center">{t("activity.training.noResults")}</p>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-card bg-hf-tan">
          {matches.map((exercise, index) => {
            const name = trainingName(exercise, locale);
            const other = locale === "da" ? exercise.en : exercise.da;
            return (
              <li key={exercise.key} className={index < matches.length - 1 ? "border-b border-hf-tan-dark" : ""}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2 text-left"
                  onClick={() => {
                    onPick(exercise.key);
                    close();
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageThumb(trainingImage(exercise.key), 128)}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-full bg-hf-card object-cover"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="hf-type-body truncate">{name}</span>
                    {other !== name && <span className="hf-type-caption truncate">{other}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatKg(value: number, locale: string) {
  return value.toLocaleString(locale, { maximumFractionDigits: 1 });
}

export function TrainingExerciseCard({
  entry,
  category,
  onChange,
  onRemove,
}: {
  entry: TrainingEntry;
  category: TrainingCategory;
  onChange: (entry: TrainingEntry) => void;
  onRemove: () => void;
}) {
  const { t, locale } = useTranslation();
  const exercise = trainingExercise(entry.key);
  if (!exercise) return null;
  const maxWeight = MAX_WEIGHT[category];

  function updateSet(index: number, patch: Partial<TrainingEntry["sets"][number]>) {
    onChange({ ...entry, sets: entry.sets.map((set, i) => (i === index ? { ...set, ...patch } : set)) });
  }

  function addSet() {
    const last = entry.sets[entry.sets.length - 1] ?? { weightKg: 0, reps: 10 };
    onChange({ ...entry, sets: [...entry.sets, { ...last }] });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <ProductImageCircle imageUrl={trainingImage(exercise.key)} />
        <RemoveCircleButton ariaLabel={t("activity.training.removeExercise")} onRemove={onRemove} />
      </div>
      <h3 className="hf-type-card-title text-center">{trainingName(exercise, locale)}</h3>
      <div className="flex w-full flex-col gap-2">
        {entry.sets.map((set, index) => (
          <div key={index} className="flex flex-col gap-1 rounded-card bg-hf-tan px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="hf-type-body hf-type-strong flex-1 whitespace-nowrap">{t("activity.training.set", { n: index + 1 })}</span>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center text-hf-black"
                aria-label={t("activity.training.fewerReps")}
                disabled={set.reps <= 1}
                onClick={() => updateSet(index, { reps: Math.max(1, set.reps - 1) })}
              >
                <IconMinus size={18} />
              </button>
              <span className="hf-type-body whitespace-nowrap text-center">
                <span className="hf-type-strong">{set.reps}</span> {t("activity.training.reps")}
              </span>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center text-hf-black"
                aria-label={t("activity.training.moreReps")}
                disabled={set.reps >= MAX_TRAINING_REPS}
                onClick={() => updateSet(index, { reps: Math.min(MAX_TRAINING_REPS, set.reps + 1) })}
              >
                <IconPlus size={18} />
              </button>
              {entry.sets.length > 1 && (
                <button
                  type="button"
                  className="flex h-9 w-7 items-center justify-end text-hf-black"
                  aria-label={t("activity.training.removeSet")}
                  onClick={() => onChange({ ...entry, sets: entry.sets.filter((_, i) => i !== index) })}
                >
                  <IconX size={16} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <FieldSlider
                  value={set.weightKg}
                  min={0}
                  max={maxWeight}
                  step={0.5}
                  onChange={(value) => updateSet(index, { weightKg: Number(value) })}
                  aria-label={t("activity.training.weight")}
                />
              </div>
              <span className="hf-type-body hf-type-strong w-20 shrink-0 whitespace-nowrap text-right">
                {set.weightKg > 0 ? `${formatKg(set.weightKg, locale)} kg` : t("activity.training.bodyweight")}
              </span>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="hf-btn-text flex items-center gap-1 self-start text-hf-black" onClick={addSet}>
        <IconPlus size={16} />
        {t("activity.training.addSet")}
      </button>
    </div>
  );
}

/** Første sæt for en ny øvelse: crossfit starter uden vægt. */
export function newTrainingEntry(key: string, category: TrainingCategory): TrainingEntry {
  return { key, sets: [{ weightKg: category === "crossfit" ? 0 : 20, reps: 10 }] };
}

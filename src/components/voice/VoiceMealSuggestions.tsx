"use client";

import Link from "next/link";
import { useState } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { imageThumb } from "@/lib/image-thumb";
import type { MealSuggestion } from "@/components/voice/useMealInterpretation";

// Forslagene fra en talt sætning på Madvarer (useMealInterpretation): hver
// række har sin egen Tilføj-knap, og knappen under listen tilføjer alle.
export function VoiceMealSuggestions({
  suggestions,
  interpreting,
  failed,
  adding,
  onAdd,
  onRemove,
}: {
  suggestions: MealSuggestion[];
  interpreting: boolean;
  failed: boolean;
  adding: boolean;
  onAdd: (items: MealSuggestion[]) => Promise<boolean>;
  onRemove: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [saveFailed, setSaveFailed] = useState(false);
  const pending = suggestions.filter((item) => !item.registrationId);

  async function add(items: MealSuggestion[]) {
    setSaveFailed(!(await onAdd(items)));
  }

  if (suggestions.length === 0 && !interpreting && !failed) return null;

  return (
    <section aria-live="polite">
      <p className="hf-type-caption hf-type-strong px-1 uppercase tracking-[0.08em]">
        {t("voice.suggested")}
        {interpreting && <span className="ml-1 opacity-60">…</span>}
      </p>
      {failed && suggestions.length === 0 && (
        <p className="hf-type-small mt-1 px-1 text-hf-red-dark">{t("voice.error.aiInterpretFailed")}</p>
      )}
      {suggestions.length > 0 && (
        <ul className="hf-card mt-1">
          {suggestions.map((item) => {
            const content = (
              <>
                <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-hf-tan">
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageThumb(item.image, 128)} alt="" className="h-full w-full object-contain" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="hf-type-body hf-type-strong block truncate text-hf-black">{item.title}</span>
                    {item.estimated && (
                      <span className="hf-type-micro hf-type-strong flex-shrink-0 rounded-full bg-hf-tan px-1.5 py-0.5 uppercase text-hf-black opacity-70">
                        {t("voice.aiEstimate")}
                      </span>
                    )}
                  </span>
                  <span className="hf-type-caption mt-1 block">
                    {item.amountLabel} · {Math.round(item.kcal)} kcal
                  </span>
                </div>
              </>
            );
            return (
              <li key={item.key} className="border-b border-hf-tan-dark px-3 last:border-b-0">
                {item.registrationId ? (
                  <Link href={`/registration/${item.registrationId}`} className="flex items-center gap-2.5 py-2.5">
                    {content}
                    <IconCheck size={20} className="flex-shrink-0 text-hf-green" aria-label={t("voice.added")} />
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5 py-2.5">
                    {content}
                    <button
                      type="button"
                      onClick={() => void add([item])}
                      disabled={adding}
                      aria-label={`${t("voice.addOne")}: ${item.title}`}
                      className="hf-btn-secondary h-10 flex-shrink-0 px-3"
                    >
                      {t("voice.addOne")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item.key)}
                      aria-label={t("voice.removeSuggestion", { item: item.title })}
                      className="flex-shrink-0 text-hf-black opacity-50"
                    >
                      <IconX size={18} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {pending.length > 1 && (
        <button type="button" onClick={() => void add(pending)} disabled={adding} className="hf-btn-primary mt-3 h-12 w-full px-4">
          {adding ? t("voice.adding") : t("voice.addShownItems")}
        </button>
      )}
      {saveFailed && <p className="hf-type-small mt-2 px-1 text-hf-red-dark">{t("voice.error.couldNotSaveRegistrations")}</p>}
    </section>
  );
}

"use client";

import { useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SLEEP_QUALITY_RATINGS } from "@/lib/sleep-quality";

// "Oplevelse af søvn" (docs/DECISIONS.md 2026-09-26): same frame as the
// start-up tips — "Luk" top right, "Slå fra" bottom right — on the front
// page's cream background. Tapping a number draws a circle around it, then
// the overlay closes by itself.
const CLOSE_DELAY_MS = 750;

export function SleepQualityOverlay({
  onRate,
  onClose,
  onDisable,
}: {
  onRate: (rating: number) => void;
  onClose: () => void;
  onDisable: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  function choose(rating: number) {
    if (selected !== null) return;
    setSelected(rating);
    onRate(rating);
    window.setTimeout(onClose, CLOSE_DELAY_MS);
  }

  return (
    <div
      className="fixed inset-0 z-[56] flex flex-col bg-hf-cream"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sleep-quality-title"
    >
      <div className="flex justify-end px-5 pt-9">
        <button type="button" onClick={onClose} className="hf-type-body hf-type-strong py-2 text-hf-black">
          {t("sleepQuality.close")}
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <h2 id="sleep-quality-title" className="hf-heading text-2xl font-bold text-hf-black">
          {t("sleepQuality.question")}
        </h2>
        <div className="flex items-center justify-center gap-3">
          {SLEEP_QUALITY_RATINGS.map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => choose(rating)}
              aria-label={t("sleepQuality.ratingAriaLabel", { rating: String(rating) })}
              aria-pressed={selected === rating}
              className="relative flex size-14 items-center justify-center text-4xl font-bold text-hf-black underline decoration-2 underline-offset-8"
            >
              {rating}
              {selected === rating && (
                <svg className="pointer-events-none absolute inset-0" viewBox="0 0 56 56" aria-hidden="true">
                  <circle
                    cx="28"
                    cy="28"
                    r="25"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray="100"
                    strokeDashoffset="100"
                    transform="rotate(-90 28 28)"
                  >
                    <animate attributeName="stroke-dashoffset" from="100" to="0" dur="0.45s" fill="freeze" />
                  </circle>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex items-end justify-between px-5 pb-8">
        <button
          type="button"
          onClick={() => setInfoOpen((open) => !open)}
          aria-label={t("sleepQuality.infoAriaLabel")}
          aria-expanded={infoOpen}
          className="flex size-11 items-center justify-center text-hf-black"
        >
          <IconInfoCircle size={24} stroke={1.8} />
        </button>
        {infoOpen && (
          <p className="hf-type-small absolute bottom-20 left-5 right-5 rounded-lg bg-hf-gray-light p-4 text-left text-hf-black">
            {t("sleepQuality.info")}
          </p>
        )}
        <button type="button" onClick={onDisable} className="hf-type-body hf-type-strong py-2 text-hf-black">
          {t("sleepQuality.disable")}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { OverlayCloseControl } from "@/components/hf/OverlayFrameControls";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useShowTooltips } from "@/lib/help-prefs";
import { SLEEP_QUALITY_RATINGS } from "@/lib/sleep-quality";

// "Oplevelse af søvn" (docs/DECISIONS.md 2026-09-26, updated 2026-09-28):
// "Luk" top right, an underlined "Slå fra" link bottom right that opens the
// setting under Visning. Tapping a number fills a green circle behind it;
// ~0.5 s later the overlay slides down to a small bottom sheet with a handle,
// rests there briefly, then disappears.
const SHEET_DELAY_MS = 500;
const SHEET_REST_MS = 1300;

type Phase = "open" | "sheet" | "gone";

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
  const showTips = useShowTooltips();
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("open");

  function choose(rating: number) {
    if (selected !== null) return;
    setSelected(rating);
    onRate(rating);
    window.setTimeout(() => setPhase("sheet"), SHEET_DELAY_MS);
    window.setTimeout(() => setPhase("gone"), SHEET_DELAY_MS + SHEET_REST_MS);
    window.setTimeout(onClose, SHEET_DELAY_MS + SHEET_REST_MS + 300);
  }

  const translate =
    phase === "open" ? "translate-y-0" : phase === "sheet" ? "translate-y-[calc(100%-5rem)]" : "translate-y-full";

  return (
    <div
      className={`fixed inset-0 z-[56] flex flex-col bg-hf-cream transition-transform duration-300 ease-out ${translate} ${
        phase === "open" ? "" : "rounded-t-2xl shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sleep-quality-title"
    >
      {phase !== "open" && (
        <div className="flex justify-center pt-3" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-hf-gray" />
        </div>
      )}

      {selected === null && (
        <div className="flex justify-end px-5 pt-9">
          <OverlayCloseControl label={t("sleepQuality.close")} counting={false} secondsLeft={0} onClose={onClose} />
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <h2 id="sleep-quality-title" className="hf-type-page-title hf-heading text-hf-black">
            {t("sleepQuality.question")}
          </h2>
          {showTips && <p className="hf-type-small max-w-sm text-hf-gray">{t("sleepQuality.info")}</p>}
        </div>
        <div className="flex items-center justify-center gap-3">
          {SLEEP_QUALITY_RATINGS.map((rating) => {
            const isSelected = selected === rating;
            return (
              <button
                key={rating}
                type="button"
                onClick={() => choose(rating)}
                aria-label={t("sleepQuality.ratingAriaLabel", { rating: String(rating) })}
                aria-pressed={isSelected}
                className={`flex size-14 items-center justify-center rounded-full text-4xl font-semibold no-underline transition-colors ${
                  isSelected ? "bg-hf-green text-white" : "text-hf-black"
                }`}
              >
                {rating}
              </button>
            );
          })}
        </div>
      </div>

      {selected === null && (
        <div className="flex justify-end px-5 pb-8">
          <button type="button" onClick={onDisable} className="hf-type-body text-hf-black underline underline-offset-4">
            {t("sleepQuality.disable")}
          </button>
        </div>
      )}
    </div>
  );
}

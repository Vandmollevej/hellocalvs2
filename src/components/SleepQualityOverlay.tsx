"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OverlayCloseControl } from "@/components/hf/OverlayFrameControls";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useShowTooltips } from "@/lib/help-prefs";
import { SLEEP_QUALITY_RATINGS } from "@/lib/sleep-quality";

// "Oplevelse af søvn" (docs/DECISIONS.md 2026-09-26, 2026-09-28): "Luk" top
// right, underlined "Slå fra" bottom right that opens the setting under
// Visning. Tapping a number fills a green circle behind it; after ~0.5 s the
// overlay slides down to a small bottom sheet with a handle (drag/tap up to
// reopen), then disappears.
const PEEK_DELAY_MS = 500;
const PEEK_HOLD_MS = 1400;
const PEEK_HEIGHT_PX = 72;
export const SLEEP_QUALITY_SETTING_HREF =
  "/settings/display/sleep-quality?focus=toggle";

type Phase = "open" | "peek" | "gone";

export function SleepQualityOverlay({
  onRate,
  onClose,
}: {
  onRate: (rating: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const showTips = useShowTooltips();
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("open");
  const timers = useRef<number[]>([]);
  const dragStartY = useRef<number | null>(null);

  function clearTimers() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }

  useEffect(() => clearTimers, []);

  function schedule(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function choose(rating: number) {
    if (phase !== "open") return;
    clearTimers();
    setSelected(rating);
    onRate(rating);
    schedule(() => {
      setPhase("peek");
      schedule(() => {
        setPhase("gone");
        schedule(onClose, 300);
      }, PEEK_HOLD_MS);
    }, PEEK_DELAY_MS);
  }

  function reopen() {
    if (phase !== "peek") return;
    clearTimers();
    setPhase("open");
  }

  function disable() {
    clearTimers();
    onClose();
    router.push(SLEEP_QUALITY_SETTING_HREF);
  }

  const transform =
    phase === "open"
      ? "translateY(0)"
      : phase === "peek"
        ? `translateY(calc(100% - ${PEEK_HEIGHT_PX}px))`
        : "translateY(100%)";

  return (
    <div
      className={`fixed inset-0 z-[56] flex flex-col bg-hf-cream transition-[transform,border-radius] duration-300 ease-out ${
        phase === "open"
          ? ""
          : "rounded-t-3xl shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"
      }`}
      style={{ transform }}
      role="dialog"
      aria-modal={phase === "open"}
      aria-labelledby="sleep-quality-title"
    >
      {phase !== "open" && (
        <button
          type="button"
          onClick={reopen}
          onPointerDown={(e) => (dragStartY.current = e.clientY)}
          onPointerUp={(e) => {
            if (
              dragStartY.current !== null &&
              dragStartY.current - e.clientY > 10
            )
              reopen();
            dragStartY.current = null;
          }}
          aria-label={t("sleepQuality.question")}
          className="flex w-full touch-none justify-center pt-3 pb-6"
        >
          <span className="h-1.5 w-12 rounded-full bg-hf-black/30" />
        </button>
      )}

      <div className="flex min-h-[3.5rem] justify-end px-5 pt-9">
        {selected === null && (
          <OverlayCloseControl
            label={t("sleepQuality.close")}
            counting={false}
            secondsLeft={0}
            onClose={onClose}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="flex flex-col gap-3">
          <h2
            id="sleep-quality-title"
            className="hf-type-page-title hf-heading text-hf-black"
          >
            {t("sleepQuality.question")}
          </h2>
          {showTips && (
            <p className="hf-type-small text-text-secondary">
              {t("sleepQuality.info")}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2">
          {SLEEP_QUALITY_RATINGS.map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => choose(rating)}
              aria-label={t("sleepQuality.ratingAriaLabel", {
                rating: String(rating),
              })}
              aria-pressed={selected === rating}
              className={`flex size-16 items-center justify-center rounded-full text-4xl font-semibold no-underline transition-colors duration-200 ${
                selected === rating ? "bg-hf-green text-white" : "text-hf-black"
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end px-5 pb-8">
        <button
          type="button"
          onClick={disable}
          className="hf-type-body text-hf-black underline underline-offset-4"
        >
          {t("sleepQuality.disable")}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet, useBottomSheetClose } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useShowTooltips } from "@/lib/help-prefs";
import { SLEEP_QUALITY_RATINGS } from "@/lib/sleep-quality";

// "Oplevelse af søvn" (docs/DECISIONS.md 2026-09-29): vises som bundark
// (popup, lukkes ved træk ned) — aldrig "Luk". Tallene står i skærmens
// lodrette midte; "Slå fra" (uden understregning) nederst til venstre åbner
// indstillingen under Visning. Et tryk på et tal fylder en grøn cirkel bag
// det, og efter ~0,5 s glider arket ned.
const CLOSE_DELAY_MS = 500;
export const SLEEP_QUALITY_SETTING_HREF =
  "/settings/display/sleep-quality?focus=toggle";

export function SleepQualityOverlay({
  onRate,
  onClose,
}: {
  onRate: (rating: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const disabling = useRef(false);

  return (
    <BottomSheet
      size="full"
      ariaLabel={t("sleepQuality.question")}
      onClose={() => {
        onClose();
        if (disabling.current) router.push(SLEEP_QUALITY_SETTING_HREF);
      }}
      footer={<DisableButton label={t("sleepQuality.disable")} onClick={() => (disabling.current = true)} />}
    >
      <SleepQualityBody onRate={onRate} />
    </BottomSheet>
  );
}

function DisableButton({ label, onClick }: { label: string; onClick: () => void }) {
  const close = useBottomSheetClose();
  return (
    <div className="flex justify-start">
      <button
        type="button"
        onClick={() => {
          onClick();
          close();
        }}
        className="hf-type-body py-2 text-hf-black no-underline"
      >
        {label}
      </button>
    </div>
  );
}

function SleepQualityBody({ onRate }: { onRate: (rating: number) => void }) {
  const { t } = useTranslation();
  const showTips = useShowTooltips();
  const close = useBottomSheetClose();
  const [selected, setSelected] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  function choose(rating: number) {
    if (selected !== null) return;
    setSelected(rating);
    onRate(rating);
    timer.current = window.setTimeout(close, CLOSE_DELAY_MS);
  }

  return (
    <div className="relative h-full min-h-[24rem] px-6 text-center">
      <div className="absolute inset-x-6 bottom-[calc(50%+3.5rem)] flex flex-col gap-3">
        <h2 className="hf-type-page-title hf-heading text-hf-black">
          {t("sleepQuality.question")}
        </h2>
        {showTips && (
          <p className="hf-type-small text-text-secondary">
            {t("sleepQuality.info")}
          </p>
        )}
      </div>
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-2">
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
  );
}

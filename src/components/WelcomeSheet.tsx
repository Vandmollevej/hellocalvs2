"use client";

import { useState } from "react";
import { IconCalendar, IconChartBar, IconChevronRight, IconFingerprint, IconHeartbeat, type Icon } from "@tabler/icons-react";
import { BottomSheet, BottomSheetCloseButton, BottomSheetDots } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";

// Velkomst efter kontooprettelse (KRAV.md "Bundark", 2026-09-27) — erstatter
// den gamle hardkodede prototype-spotlight over tilføj-knappen. Slides med
// prikker og pil som referencebilledet; "Start guiden" åbner OnboardingWizard,
// "Spring over" (eller et træk ned) lukker bare.
const SLIDES: Array<{ icon: Icon; titleKey: string; textKey: string }> = [
  { icon: IconHeartbeat, titleKey: "welcomeSheet.slide1Title", textKey: "welcomeSheet.slide1Text" },
  { icon: IconFingerprint, titleKey: "welcomeSheet.slide2Title", textKey: "welcomeSheet.slide2Text" },
  { icon: IconCalendar, titleKey: "welcomeSheet.slide3Title", textKey: "welcomeSheet.slide3Text" },
  { icon: IconChartBar, titleKey: "welcomeSheet.slide4Title", textKey: "welcomeSheet.slide4Text" },
];

export function WelcomeSheet({ onClose, onStartGuide }: { onClose: () => void; onStartGuide: () => void }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [startGuide, setStartGuide] = useState(false);
  const slide = SLIDES[index];
  const SlideIcon = slide.icon;
  const isLast = index === SLIDES.length - 1;

  return (
    <BottomSheet
      size="full"
      ariaLabel={t(slide.titleKey)}
      onClose={() => {
        onClose();
        if (startGuide) onStartGuide();
      }}
      footer={
        <>
          <div className="relative flex h-10 items-center justify-center">
            <BottomSheetDots
              count={SLIDES.length}
              active={index}
              label={t("welcomeSheet.progress", { current: index + 1, total: SLIDES.length })}
              onSelect={setIndex}
            />
            {!isLast && (
              <button
                type="button"
                onClick={() => setIndex(index + 1)}
                aria-label={t("welcomeSheet.nextSlide")}
                className="absolute right-[20%] flex size-10 items-center justify-center text-hf-black"
              >
                <IconChevronRight size={24} />
              </button>
            )}
          </div>
          <BottomSheetCloseButton onClick={() => setStartGuide(true)} className="hf-control hf-btn-primary mt-4 w-full">
            {t("welcomeSheet.startGuide")}
          </BottomSheetCloseButton>
          <BottomSheetCloseButton className="hf-bottom-sheet__skip">{t("welcomeSheet.skip")}</BottomSheetCloseButton>
        </>
      }
    >
      <div className="flex min-h-full flex-col items-center justify-center gap-6 px-4 text-center">
        <span className="flex size-40 items-center justify-center rounded-full bg-hf-tan text-hf-green">
          <SlideIcon size={72} stroke={1.4} />
        </span>
        <h2 className="hf-type-page-title text-center">{t(slide.titleKey)}</h2>
        <p className="hf-type-body-lg">{t(slide.textKey)}</p>
      </div>
    </BottomSheet>
  );
}

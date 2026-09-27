"use client";

import { useState } from "react";
import { BottomSheet, useBottomSheetClose } from "@/components/hf/BottomSheet";
import { translate } from "@/i18n";
import { screenBackground, type GuideConfig, type GuideLang } from "@/lib/guide-builder";
import { StartupGuideView, TooltipsView } from "./GuideScreenView";

// Startup-guiden og tooltips i bundarket (KRAV.md "Bundark", 2026-09-27):
// glider op nedefra, trækstreg øverst, træk ned/hurtigt swipe lukker. Arket
// får skærmens baggrund, så trækstregen står på samme flade som guiden.
export function GuideOverlay({
  config,
  lang,
  startIndex = 0,
  onClose,
}: {
  config: GuideConfig;
  lang: GuideLang;
  startIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(Math.min(startIndex, config.screens.length - 1));
  const screen = config.screens[index] ?? config.screens[0];
  const background = screenBackground(config, screen);

  return (
    <BottomSheet
      size="full"
      ariaLabel={translate(lang, "guide.progress")}
      panelStyle={{ background: `var(${background.token})` }}
      onClose={onClose}
    >
      <GuideSheetContent config={config} lang={lang} index={index} onIndexChange={setIndex} />
    </BottomSheet>
  );
}

function GuideSheetContent({
  config,
  lang,
  index,
  onIndexChange,
}: {
  config: GuideConfig;
  lang: GuideLang;
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const close = useBottomSheetClose();
  const [values, setValues] = useState<Record<string, number>>({});

  // Stepper-værdier lever kun i overlayet (preview) — ikke i opsætningen.
  const live: GuideConfig = {
    ...config,
    screens: config.screens.map((s) => ({
      ...s,
      elements: s.elements.map((el) => (el.type === "setting" && el.id in values ? { ...el, value: values[el.id] } : el)),
    })),
  };

  return (
    <div className="mx-auto h-full w-full max-w-[430px]">
      {config.kind === "startup" ? (
        <StartupGuideView
          config={live}
          index={index}
          lang={lang}
          onBack={() => onIndexChange(Math.max(0, index - 1))}
          onNext={() => (index >= config.screens.length - 1 ? close() : onIndexChange(index + 1))}
          onAskLater={close}
          onSettingChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
        />
      ) : (
        <TooltipsView config={live} index={index} lang={lang} onIndexChange={onIndexChange} onDone={close} onSkip={close} />
      )}
    </div>
  );
}

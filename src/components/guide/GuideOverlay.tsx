"use client";

import { useState, type CSSProperties } from "react";
import { OverlayCloseControl } from "@/components/hf/OverlayFrameControls";
import { translate } from "@/i18n";
import { screenBackground, type GuideConfig, type GuideLang } from "@/lib/guide-builder";
import { StartupGuideView, TooltipsView } from "./GuideScreenView";

// Startup-guiden og tooltips i det fælles fuldskærms-overlay (samme skal som
// StartupTipOverlay/designmanualens overlay-demo: fixed, z-55, "Luk" øverst
// til højre via OverlayCloseControl).
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
  const [values, setValues] = useState<Record<string, number>>({});
  const screen = config.screens[index] ?? config.screens[0];
  const dark = screenBackground(config, screen).dark;

  // Stepper-værdier lever kun i overlayet (preview) — ikke i opsætningen.
  const live: GuideConfig = {
    ...config,
    screens: config.screens.map((s) => ({
      ...s,
      elements: s.elements.map((el) => (el.type === "setting" && el.id in values ? { ...el, value: values[el.id] } : el)),
    })),
  };

  const topSlot = (
    <div
      className="flex shrink-0 justify-end px-4 pt-9"
      style={dark ? ({ "--hf-black": "#FFFFFF" } as CSSProperties) : undefined}
    >
      <OverlayCloseControl label={translate(lang, "guide.close")} counting={false} secondsLeft={0} onClose={onClose} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[55] flex justify-center bg-hf-cream" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-[430px]">
        {config.kind === "startup" ? (
          <StartupGuideView
            config={live}
            index={index}
            lang={lang}
            topSlot={topSlot}
            onBack={() => setIndex((i) => Math.max(0, i - 1))}
            onNext={() => (index >= config.screens.length - 1 ? onClose() : setIndex(index + 1))}
            onAskLater={onClose}
            onSettingChange={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
          />
        ) : (
          <TooltipsView config={live} index={index} lang={lang} topSlot={topSlot} onIndexChange={setIndex} onDone={onClose} onSkip={onClose} />
        )}
      </div>
    </div>
  );
}

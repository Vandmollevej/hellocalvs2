"use client";

import { IconShieldLock } from "@tabler/icons-react";
import { ActionLink } from "@/components/hf/ActionButton";
import { BottomSheet, useBottomSheetClose } from "@/components/hf/BottomSheet";
import { OverlayCloseControl, OverlayDisableToggle, useDisableCountdown } from "@/components/hf/OverlayFrameControls";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { StartupTip, StartupTipIcon } from "@/lib/startup-tips";

const ICONS: Record<StartupTipIcon, typeof IconShieldLock> = {
  privacy: IconShieldLock,
};

// The fixed standard for every start-up tip: a bottom sheet (KRAV.md "Bundark",
// owner's rule 2026-10-07: popups are never overlays) with icon + title + text,
// an optional big button, "Luk" bottom left and "Slå fra" bottom right (plain
// text + switch; switching it off counts "Luk" down 3–1, then turns start-up
// tips off entirely). Swipe down = Luk.
export function StartupTipOverlay({
  tip,
  onClose,
  onDisable,
}: {
  tip: StartupTip;
  onClose: () => void;
  onDisable: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet ariaLabel={t(tip.titleKey)} onClose={onClose}>
      <TipBody tip={tip} onClose={onClose} onDisable={onDisable} />
    </BottomSheet>
  );
}

function TipBody({ tip, onClose, onDisable }: { tip: StartupTip; onClose: () => void; onDisable: () => void }) {
  const { t } = useTranslation();
  const Icon = ICONS[tip.icon];
  const disable = useDisableCountdown(onDisable);
  // "Luk" glider arket ud (som et swipe ned); onClose kaldes bagefter af arket.
  const closeSheet = useBottomSheetClose();

  return (
    <div className="flex flex-col items-center gap-5 px-6 pb-4 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-hf-tan text-hf-green">
        <Icon size={40} stroke={1.6} />
      </span>
      <h2 className="hf-type-page-title hf-heading text-hf-black">{t(tip.titleKey)}</h2>
      <p className="text-text-secondary hf-type-body">{t(tip.bodyKey)}</p>
      {tip.action && (
        <ActionLink href={tip.action.href} onClick={onClose} className="mt-2">
          {t(tip.action.labelKey)}
        </ActionLink>
      )}
      <div className="flex w-full items-center justify-between">
        <OverlayCloseControl
          label={t("startupTips.close")}
          counting={disable.counting}
          secondsLeft={disable.secondsLeft}
          onClose={closeSheet}
        />
        <OverlayDisableToggle label={t("startupTips.disable")} enabled={disable.enabled} onChange={disable.setEnabled} />
      </div>
    </div>
  );
}

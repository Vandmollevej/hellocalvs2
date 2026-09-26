"use client";

import { IconShieldLock } from "@tabler/icons-react";
import { ActionLink } from "@/components/hf/ActionButton";
import { OverlayCloseControl, OverlayDisableToggle, useDisableCountdown } from "@/components/hf/OverlayFrameControls";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { StartupTip, StartupTipIcon } from "@/lib/startup-tips";

const ICONS: Record<StartupTipIcon, typeof IconShieldLock> = {
  privacy: IconShieldLock,
};

// The fixed standard for every start-up tip: "Luk" top right, icon + title +
// text in the middle, an optional big button, and "Slå fra" bottom right
// (plain text + switch; switching it off counts "Luk" down 3–1, then turns
// start-up tips off entirely).
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
  const Icon = ICONS[tip.icon];
  const disable = useDisableCountdown(onDisable);

  return (
    <div
      className="fixed inset-0 z-[55] flex flex-col bg-hf-cream"
      role="dialog"
      aria-modal="true"
      aria-labelledby="startup-tip-title"
    >
      <div className="flex justify-end px-5 pt-9">
        <OverlayCloseControl
          label={t("startupTips.close")}
          counting={disable.counting}
          secondsLeft={disable.secondsLeft}
          onClose={onClose}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-hf-tan text-hf-green">
          <Icon size={40} stroke={1.6} />
        </span>
        <h2 id="startup-tip-title" className="hf-heading text-2xl font-bold text-hf-black">
          {t(tip.titleKey)}
        </h2>
        <p className="hf-type-body text-hf-black opacity-80">{t(tip.bodyKey)}</p>
        {tip.action && (
          <ActionLink href={tip.action.href} onClick={onClose} className="mt-2">
            {t(tip.action.labelKey)}
          </ActionLink>
        )}
      </div>

      <div className="flex justify-end px-5 pb-8">
        <OverlayDisableToggle label={t("startupTips.disable")} enabled={disable.enabled} onChange={disable.setEnabled} />
      </div>
    </div>
  );
}

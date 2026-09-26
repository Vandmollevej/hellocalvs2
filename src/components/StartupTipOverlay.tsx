"use client";

import { IconShieldLock } from "@tabler/icons-react";
import { ActionLink } from "@/components/hf/ActionButton";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { StartupTip, StartupTipIcon } from "@/lib/startup-tips";

const ICONS: Record<StartupTipIcon, typeof IconShieldLock> = {
  privacy: IconShieldLock,
};

// The fixed standard for every start-up tip: "Luk" top right, icon + title +
// text in the middle, an optional big button, and "Slå fra" bottom right
// (turns start-up tips off entirely).
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

  return (
    <div
      className="fixed inset-0 z-[55] flex flex-col bg-hf-cream"
      role="dialog"
      aria-modal="true"
      aria-labelledby="startup-tip-title"
    >
      <div className="flex justify-end px-5 pt-9">
        <button type="button" onClick={onClose} className="hf-type-body hf-type-strong py-2 text-hf-green">
          {t("startupTips.close")}
        </button>
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
        <button type="button" onClick={onDisable} className="hf-type-body py-2 text-hf-black opacity-60">
          {t("startupTips.disable")}
        </button>
      </div>
    </div>
  );
}

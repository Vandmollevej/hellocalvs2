"use client";

import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { HelpTip } from "@/components/hf/HelpTip";
import { useTranslation } from "@/i18n/LocaleProvider";
import { saveShowStartupTips, saveShowTooltips, useShowStartupTips, useShowTooltips } from "@/lib/help-prefs";

// Settings → Visning → Tips og hjælpetekster: de to on/off-kontakter, der før
// lå løse nederst på Indstillinger.
export default function TipsSettingsPage() {
  const { t } = useTranslation();
  const showTooltips = useShowTooltips();
  const showStartupTips = useShowStartupTips();

  return (
    <HfScreen title={t("settings.tipsTitle")}>
      <div className="flex flex-col gap-4 p-4">
        <HelpTip>{t("settings.displayHelpTip")}</HelpTip>
        <Toggle
          label={t("settings.showTooltips")}
          description={t("settings.showTooltipsDescription")}
          checked={showTooltips}
          onChange={saveShowTooltips}
        />
        <Toggle
          label={t("settings.showStartupTips")}
          description={t("settings.showStartupTipsDescription")}
          checked={showStartupTips}
          onChange={saveShowStartupTips}
        />
      </div>
    </HfScreen>
  );
}

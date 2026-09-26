// Start-up tips (Settings → Visning → "Vis start-up tips"): one-page overlays
// that each present a feature the user has not used yet. Every tip follows the
// same fixed standard (src/components/StartupTipOverlay.tsx): icon, title,
// body text and an optional big action button. Tips are shown one per visit,
// in list order, and a tip counts as done once closed or once its feature is
// used (markStartupTipSeen in src/lib/help-prefs.ts).
export type StartupTipIcon = "privacy";

export type StartupTip = {
  id: string;
  icon: StartupTipIcon;
  titleKey: string;
  bodyKey: string;
  action?: { labelKey: string; href: string };
};

export const STARTUP_TIPS: StartupTip[] = [
  {
    // Always the first tip on a first visit: what data we keep, with a link to
    // the privacy policy.
    id: "privacy-data",
    icon: "privacy",
    titleKey: "startupTips.privacy.title",
    bodyKey: "startupTips.privacy.body",
    action: { labelKey: "startupTips.privacy.action", href: "/privatlivspolitik" },
  },
];

export function nextStartupTip(seen: string[]): StartupTip | null {
  return STARTUP_TIPS.find((tip) => !seen.includes(tip.id)) ?? null;
}

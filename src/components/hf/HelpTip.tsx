"use client";

import { useShowTooltips } from "@/lib/help-prefs";

// Small help text under a setting or window, shown only while
// Settings → Visning → "Vis tooltips" is on.
export function HelpTip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const show = useShowTooltips();
  if (!show) return null;
  return <p className={`text-text-secondary hf-type-small px-1 ${className}`.trim()}>{children}</p>;
}

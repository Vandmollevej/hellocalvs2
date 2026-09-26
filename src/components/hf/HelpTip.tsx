"use client";

import { useShowTooltips } from "@/lib/help-prefs";

// Small help text under a setting or window, shown only while
// Settings → Visning → "Vis tooltips" is on.
export function HelpTip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const show = useShowTooltips();
  if (!show) return null;
  return <p className={`hf-type-small px-1 text-hf-black opacity-60 ${className}`.trim()}>{children}</p>;
}

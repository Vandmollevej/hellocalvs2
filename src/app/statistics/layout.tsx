"use client";

import { usePathname } from "next/navigation";
import { PremiumGate } from "@/components/PremiumGate";

// Hele statistikmodulet er kun for Seriøs (docs/DECISIONS.md 2026-09-26).
// Selve statistiksiden tegnes som skelet, mens niveauet hentes
// (renderWhilePending) og venter selv med datahentningen via
// usePremiumPending(). Undersiderne gør ikke det, så de vises først, når
// niveauet er kendt.
export default function StatisticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <PremiumGate titleKey="statistics.title" renderWhilePending={pathname === "/statistics"}>
      {children}
    </PremiumGate>
  );
}

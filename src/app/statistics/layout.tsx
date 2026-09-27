import { PremiumGate } from "@/components/PremiumGate";

// Hele statistikmodulet er kun for Seriøs (docs/DECISIONS.md 2026-09-26).
export default function StatisticsLayout({ children }: { children: React.ReactNode }) {
  return <PremiumGate titleKey="statistics.title">{children}</PremiumGate>;
}

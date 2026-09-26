import { PremiumGate } from "@/components/PremiumGate";

// Allergen- og kostvisning er kun for Seriøs (docs/DECISIONS.md 2026-09-26).
export default function ResultsDisplayLayout({ children }: { children: React.ReactNode }) {
  return <PremiumGate titleKey="settings.resultsDisplay">{children}</PremiumGate>;
}

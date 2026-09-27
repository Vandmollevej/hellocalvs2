import { PremiumGate } from "@/components/PremiumGate";

// Delmål er kun for Seriøs; Gratis har én målsætning i alt (målvægten) og
// ingen delmål (docs/DECISIONS.md 2026-09-26).
export default function NewSubGoalLayout({ children }: { children: React.ReactNode }) {
  return <PremiumGate titleKey="goals.createSubGoal">{children}</PremiumGate>;
}

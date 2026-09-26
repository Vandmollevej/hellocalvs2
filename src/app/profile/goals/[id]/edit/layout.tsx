import { PremiumGate } from "@/components/PremiumGate";

// Samme gating som oprettelse af delmål (docs/DECISIONS.md 2026-09-26).
export default function EditGoalLayout({ children }: { children: React.ReactNode }) {
  return <PremiumGate titleKey="goals.editTitle">{children}</PremiumGate>;
}

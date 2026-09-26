import { PremiumGate } from "@/components/PremiumGate";

// Fotodagbogen er kun for Seriøs (docs/DECISIONS.md 2026-09-26).
export default function PhotoDiaryLayout({ children }: { children: React.ReactNode }) {
  return <PremiumGate titleKey="photoDiary.title">{children}</PremiumGate>;
}

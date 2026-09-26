import { PremiumGate } from "@/components/PremiumGate";

// Integrationerne er kun for Seriøs (docs/DECISIONS.md 2026-09-26).
export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return <PremiumGate titleKey="integrations.title">{children}</PremiumGate>;
}

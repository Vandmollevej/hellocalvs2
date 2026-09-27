import { PremiumGate } from "@/components/PremiumGate";

// Visningsindstillingerne (til/fra) er kun for Seriøs (docs/DECISIONS.md 2026-09-26).
export default function DisplaySettingsLayout({ children }: { children: React.ReactNode }) {
  return <PremiumGate titleKey="settings.display">{children}</PremiumGate>;
}

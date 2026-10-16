import Link from "next/link";
import type { Locale } from "@prisma/client";
import { t } from "@/lib/admin-i18n";

// Faner under Kvalitetskontrol: produkter, delte retter og brugertilføjede aktiviteter
// (docs/DECISIONS.md 2026-09-24).
export function QualityControlTabs({ active, locale }: { active: "products" | "sharedRecipes" | "activities"; locale: Locale }) {
  const tabs = [
    { key: "products", href: "/admin/quality-control", label: t(locale, "quality_control_tab_products") },
    { key: "sharedRecipes", href: "/admin/quality-control/shared-recipes", label: t(locale, "quality_control_tab_shared_recipes") },
    { key: "activities", href: "/admin/quality-control/activities", label: t(locale, "quality_control_tab_activities") },
  ] as const;
  return (
    <div className="hf-type-body flex gap-4 border-b border-hf-tan-dark">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`-mb-px border-b-2 pb-2 ${
            active === tab.key
              ? "hf-type-strong border-hf-green-dark text-hf-green-dark"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

import Link from "next/link";
import type { Locale } from "@prisma/client";
import { t } from "@/lib/admin-i18n";

// Faner under Kvalitetskontrol: produkter og delte retter
// (docs/DECISIONS.md 2026-09-24).
export function QualityControlTabs({ active, locale }: { active: "products" | "sharedRecipes"; locale: Locale }) {
  const tabs = [
    { key: "products", href: "/admin/quality-control", label: t(locale, "quality_control_tab_products") },
    { key: "sharedRecipes", href: "/admin/quality-control/shared-recipes", label: t(locale, "quality_control_tab_shared_recipes") },
  ] as const;
  return (
    <div className="flex gap-4 border-b border-border-strong text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`-mb-px border-b-2 pb-2 ${
            active === tab.key
              ? "border-hf-green-dark font-medium text-hf-green-dark"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

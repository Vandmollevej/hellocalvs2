import Link from "next/link";
import type { Locale } from "@prisma/client";
import { t } from "@/lib/admin-i18n";

// Faner under Varegodkendelse → billeder: billedforslag til godkendelse og
// billeder i kø til frilæggelse (docs/DECISIONS.md 2026-10-02).
export function ImagesTabs({ active, locale }: { active: "suggestions" | "cutoutQueue"; locale: Locale }) {
  const tabs = [
    { key: "suggestions", href: "/admin/images", label: t(locale, "nav_images") },
    { key: "cutoutQueue", href: "/admin/images/cutout-queue", label: t(locale, "nav_cutout_queue") },
  ] as const;
  return (
    <div className="hf-type-body flex flex-wrap gap-4 border-b border-hf-tan-dark">
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

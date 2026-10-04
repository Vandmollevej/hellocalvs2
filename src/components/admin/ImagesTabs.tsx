import Link from "next/link";

// Faner under Billedbehandling: billedforslag til godkendelse, billeder i kø
// til frilæggelse og logoer (docs/DECISIONS.md 2026-10-02 og 2026-10-04).
export function ImagesTabs({ active }: { active: "suggestions" | "cutoutQueue" | "logos" }) {
  const tabs = [
    { key: "suggestions", href: "/admin/images", label: "Billedforslag" },
    { key: "cutoutQueue", href: "/admin/images/cutout-queue", label: "Billeder i kø til frilæggelse" },
    { key: "logos", href: "/admin/logos", label: "Logoer" },
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

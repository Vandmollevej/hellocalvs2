import Link from "next/link";

export type StatsView = "users" | "traffic" | "ads" | "doc";

const TABS: { id: StatsView; label: string; href: string }[] = [
  { id: "users", label: "Brugere og indtjening", href: "/admin/statistics" },
  { id: "traffic", label: "Trafik", href: "/admin/statistics?view=traffic" },
  { id: "ads", label: "Reklamer", href: "/admin/statistics?view=ads" },
  { id: "doc", label: "Hello Doc", href: "/admin/statistics?view=doc" },
];

export function parseStatsView(value: string | string[] | undefined): StatsView {
  return value === "traffic" || value === "ads" || value === "doc" ? value : "users";
}

export function StatsTabs({ active }: { active: StatsView }) {
  return (
    <nav className="hf-type-body flex flex-wrap hf-surface p-0.5 self-start" aria-label="Statistik">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`rounded-md px-3 py-1.5 ${
            tab.id === active ? "hf-type-strong hf-selected" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

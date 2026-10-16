import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { SPELLING_TABS, listSpellingIssues, spellingTab, spellingTabCounts } from "@/lib/spelling-issues-query";
import { SpellingReviewTable } from "@/components/admin/SpellingReviewTable";

// Admin → Stavekontrol (docs/DECISIONS.md 2026-10-14): rapporten fra nattens
// stavekontrol-robot (job "spelling-check"). "Til gennemsyn" er fund, robotten
// ikke turde rette; "Rettet automatisk" er de sikre rettelser, den lavede
// (kan fortrydes). Hver afgørelse lærer ordbogen.

const dateFormat = new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Copenhagen" });

export default async function AdminSpellingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const tab = spellingTab((await searchParams).tab);

  const [counts, rows, job, rules] = await Promise.all([
    spellingTabCounts(),
    listSpellingIssues(tab.key, 0),
    prisma.scheduledJob.findUnique({ where: { key: "spelling-check" } }),
    prisma.spellingRule.count(),
  ]);

  return (
    <div className="hf-admin-page">
      <div className="flex flex-col gap-1">
        <h1 className="hf-type-page-title text-hf-black">Stavekontrol</h1>
        <p className="hf-type-body text-text-secondary">
          Seneste kørsel:{" "}
          {job?.lastRunAt ? `${dateFormat.format(job.lastRunAt)} — ${job.lastMessage ?? job.lastStatus ?? ""}` : "ikke kørt endnu"}
          {" · "}
          {rules} lærte {rules === 1 ? "afgørelse" : "afgørelser"} ·{" "}
          <Link href="/admin/robots" className="hf-btn-text text-hf-green-dark">
            Plan og kør nu
          </Link>
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Status">
        {SPELLING_TABS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "pending" ? "/admin/spelling" : `/admin/spelling?tab=${item.key}`}
            aria-pressed={item.key === tab.key}
            className="hf-choice"
          >
            {item.label} ({counts[item.key]})
          </Link>
        ))}
      </nav>

      <SpellingReviewTable
        key={tab.key}
        tab={tab.key}
        total={counts[tab.key]}
        initialRows={rows}
        canEdit={admin.adminAccessLevel === "FULL"}
      />
    </div>
  );
}

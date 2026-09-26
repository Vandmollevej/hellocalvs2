import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { PendingBugReportCard } from "@/components/admin/PendingBugReportCard";
import { t } from "@/lib/admin-i18n";

export default async function AdminBugReportsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const reports = await prisma.bugReport.findMany({
    where: { status: "PENDING" },
    select: {
      id: true,
      description: true,
      screenshotUrl: true,
      createdAt: true,
      source: true,
      user: { select: { displayName: true, email: true } },
      product: { select: { id: true, name: true, brand: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">{t(admin.locale, "bug_reports_title")}</h1>
      <p className="hf-type-body text-text-secondary">
        Godkendelse giver brugeren 10 points (gælder ikke AI-genererede rapporter). Nyeste øverst.
      </p>
      {reports.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen fejlrapporter afventer gennemgang.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((report) => (
            <PendingBugReportCard
              key={report.id}
              report={{ ...report, createdAt: report.createdAt.toISOString() }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { PendingBugReportCard } from "@/components/admin/PendingBugReportCard";

export default async function AdminBugReportsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const reports = await prisma.bugReport.findMany({
    where: { status: "PENDING" },
    include: { user: { select: { displayName: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">Fejlrapporter</h1>
      <p className="text-sm text-text-secondary">
        Godkendelse giver brugeren 10 points. Nyeste øverst.
      </p>
      {reports.length === 0 ? (
        <p className="text-sm text-text-secondary">Ingen fejlrapporter afventer gennemgang.</p>
      ) : (
        <div className="flex flex-col gap-3">
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

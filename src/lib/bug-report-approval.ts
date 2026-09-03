import { prisma } from "@/lib/prisma";
import { awardPoints } from "@/lib/points";
import { queueMessage } from "@/lib/messaging";

// Delt godkendelses-/afvisningslogik for fejlrapporter — samme mønster som
// src/lib/product-approval.ts. 10 points ved godkendelse (docs/DECISIONS.md
// 2026-09-02).
const BUG_REPORT_POINTS = 10;

export async function approveBugReport(id: string) {
  const existing = await prisma.bugReport.findUnique({ where: { id } });
  if (!existing) return null;

  const report = await prisma.bugReport.update({
    where: { id },
    data: { status: "APPROVED", resolvedAt: new Date(), approvalToken: null },
  });

  await awardPoints(existing.userId, "BUG_REPORT_APPROVED", BUG_REPORT_POINTS, { bugReportId: id });
  await queueMessage("BUG_REPORT_RESOLVED", { userId: existing.userId });

  return report;
}

export async function rejectBugReport(id: string) {
  const existing = await prisma.bugReport.findUnique({ where: { id } });
  if (!existing) return null;

  return prisma.bugReport.update({
    where: { id },
    data: { status: "REJECTED", resolvedAt: new Date(), approvalToken: null },
  });
}

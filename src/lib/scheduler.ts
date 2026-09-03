import { prisma } from "@/lib/prisma";
import { queueMessage } from "@/lib/messaging";
import { flushQueuedEmails } from "@/lib/mailer";
import { flushQueuedPush } from "@/lib/push";
import { grantEligibleReferralRewards } from "@/lib/referrals";

// In-process baggrundsjob (docs/DECISIONS.md 2026-09-02): DB-drevet, kører i
// selve Next.js-serverprocessen uanset hvor den hostes (Synology i dag,
// hvad som helst i morgen) — bevidst IKKE afhængig af OS-cron/Synology Task
// Scheduler. Starter via instrumentation.ts' register()-hook.
//
// globalThis-guard, samme mønster som src/lib/prisma.ts, for at undgå at
// starte flere parallelle intervaller ved Next.js' dev-hot-reload.

const ESCALATION_HOURS = 48;
const TICK_INTERVAL_MS = 15 * 60 * 1000;

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "peter@packroff.dk";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://hellocal.packroff.dk";

const globalForScheduler = globalThis as unknown as { hellocalSchedulerStarted?: boolean };

async function escalateStalePendingProducts(now: Date) {
  const cutoff = new Date(now.getTime() - ESCALATION_HOURS * 60 * 60 * 1000);
  const stale = await prisma.product.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff }, escalationSentAt: null },
  });

  for (const product of stale) {
    const approvalToken = product.approvalToken ?? crypto.randomUUID();
    await prisma.product.update({
      where: { id: product.id },
      data: { approvalToken, escalationSentAt: now },
    });
    await queueMessage("PRODUCT_ESCALATION_ADMIN", {
      toEmail: ADMIN_NOTIFICATION_EMAIL,
      vars: {
        productName: product.name,
        approveLink: `${APP_BASE_URL}/admin/approve/${approvalToken}`,
      },
    });
  }
}

async function escalateStaleBugReports(now: Date) {
  const cutoff = new Date(now.getTime() - ESCALATION_HOURS * 60 * 60 * 1000);
  const stale = await prisma.bugReport.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff }, escalationSentAt: null },
    include: { user: true },
  });

  for (const report of stale) {
    const approvalToken = report.approvalToken ?? crypto.randomUUID();
    await prisma.bugReport.update({
      where: { id: report.id },
      data: { approvalToken, escalationSentAt: now },
    });
    await queueMessage("BUG_REPORT_ESCALATION_ADMIN", {
      toEmail: ADMIN_NOTIFICATION_EMAIL,
      vars: {
        displayName: report.user.displayName,
        approveLink: `${APP_BASE_URL}/admin/approve/${approvalToken}`,
      },
    });
  }
}

export async function runSchedulerTick(now: Date = new Date()) {
  await escalateStalePendingProducts(now);
  await escalateStaleBugReports(now);
  await grantEligibleReferralRewards(now);
  await flushQueuedEmails();
  await flushQueuedPush();
}

export function startScheduler() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (globalForScheduler.hellocalSchedulerStarted) return;
  globalForScheduler.hellocalSchedulerStarted = true;

  const tick = () => {
    runSchedulerTick().catch((error) => {
      console.error("[scheduler] tick fejlede", error);
    });
  };

  // Første kørsel kort efter opstart, derefter hvert 15. minut.
  setTimeout(tick, 30_000);
  setInterval(tick, TICK_INTERVAL_MS);
}

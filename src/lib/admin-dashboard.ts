import { prisma } from "@/lib/prisma";
import { countSupportInbox } from "@/lib/support-inbox";
import { UNCERTAINTY_TABS, listUncertainties, type UncertaintyRow } from "@/lib/uncertainties";
import { HIDE_FROM_SEARCH_BELOW } from "@/lib/uncertainty-thresholds";
import { countDuplicateReviews } from "@/lib/duplicate-review";
import { QUALITY_CONTROL_PHOTO_TYPES } from "@/lib/quality-control-photo-types";
import { JOBS } from "@/lib/jobs/registry";
import { ensureSecretsLoaded } from "@/lib/api-keys/store";
import { allServiceStatuses } from "@/lib/api-keys/status";

// Data til admin-oversigten (docs/DECISIONS.md 2026-09-27): tællere for alle
// ventende opgaver + de seneste supportsager, produkter og fejlrapporter.
// Udvidet 2026-09-28 med scan, mail/push, usikkerheder pr. fane, drift
// (cron-jobs, manglende API-nøgler) og nøgletal, så alt kan overskues ét sted.
// Hver kilde fejler for sig, så én langsom/fejlende tabel ikke vælter siden.

const WIDGET_ROWS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return promise.catch(() => fallback);
}

function summarizeUncertainties(rows: UncertaintyRow[]) {
  const hideAbove = Math.round((1 - HIDE_FROM_SEARCH_BELOW) * 100);
  return {
    total: rows.length,
    urgent: rows.filter((row) => row.urgent).length,
    hiddenFromSearch: rows.filter((row) => row.uncertaintyPercent > hideAbove).length,
    byTab: UNCERTAINTY_TABS.map((tab) => ({
      key: tab.key,
      label: tab.label,
      count: rows.filter((row) => row.tab === tab.key).length,
    })),
    top: [...rows]
      .sort((a, b) => b.uncertaintyPercent - a.uncertaintyPercent)
      .slice(0, WIDGET_ROWS)
      .map((row) => ({
        id: row.id,
        productName: row.productName,
        brandName: row.brandName,
        tabLabel: UNCERTAINTY_TABS.find((tab) => tab.key === row.tab)?.label ?? row.tab,
        uncertaintyPercent: row.uncertaintyPercent,
        urgent: row.urgent,
      })),
  };
}

async function missingApiKeyServices() {
  await ensureSecretsLoaded();
  return allServiceStatuses()
    .filter((service) => service.fields.some((field) => !field.optional && !field.display))
    .map((service) => service.name);
}

export async function loadAdminDashboard(now: Date = new Date()) {
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [
    support,
    pendingProducts,
    uncertainties,
    bugReports,
    pendingImages,
    pendingLogos,
    qualityChecks,
    nutritionReports,
    duplicates,
    ingredientRequests,
    latestSupport,
    latestProducts,
    latestBugReports,
    scanSubmissions,
    scanMessages,
    failedMessages,
    queuedMessages,
    sentMessages,
    recentFailedMessages,
    jobRows,
    missingApiKeys,
    totalUsers,
    newUsersToday,
    newUsersWeek,
    approvedProducts,
    registrationsToday,
  ] = await Promise.all([
    safe(countSupportInbox(), { unanswered: 0, overdue: 0 }),
    safe(prisma.product.count({ where: { status: "PENDING", privateOwnerId: null } }), 0),
    safe(listUncertainties().then(summarizeUncertainties), summarizeUncertainties([])),
    safe(prisma.bugReport.count({ where: { status: "PENDING" } }), 0),
    safe(prisma.product.count({ where: { imageStatus: "PENDING" } }), 0),
    safe(prisma.brandLogoSearch.count({ where: { status: "PENDING_REVIEW" } }), 0),
    safe(
      prisma.productMatchCheck.count({
        where: { status: "PENDING", photoType: { in: [...QUALITY_CONTROL_PHOTO_TYPES] } },
      }),
      0,
    ),
    safe(prisma.productNutritionReport.count({ where: { status: "PENDING" } }), 0),
    safe(countDuplicateReviews().then((c) => c.images + c.products), 0),
    safe(prisma.ingredientRequest.count({ where: { status: "PENDING" } }), 0),
    safe(
      prisma.supportRequest.findMany({
        where: { status: "OPEN" },
        orderBy: [{ lastUserMessageAt: "desc" }, { id: "desc" }],
        take: WIDGET_ROWS,
        select: {
          id: true,
          subject: true,
          priority: true,
          awaitingReply: true,
          lastUserMessageAt: true,
          user: { select: { displayName: true, email: true } },
          messages: {
            where: { author: "USER" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true },
          },
        },
      }),
      [],
    ),
    safe(
      prisma.product.findMany({
        where: { status: "PENDING", privateOwnerId: null },
        orderBy: { createdAt: "desc" },
        take: WIDGET_ROWS,
        select: {
          id: true,
          name: true,
          createdAt: true,
          externalSource: true,
          kcalPer100g: true,
          brand: { select: { name: true } },
        },
      }),
      [],
    ),
    safe(
      prisma.bugReport.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: WIDGET_ROWS,
        select: {
          id: true,
          description: true,
          source: true,
          createdAt: true,
          user: { select: { displayName: true } },
        },
      }),
      [],
    ),
    safe(prisma.scanSubmission.count({ where: { reviewStatus: "PENDING" } }), 0),
    safe(prisma.scanMessage.count({ where: { fromAdmin: false, readAt: null } }), 0),
    safe(prisma.outboundMessage.count({ where: { status: "FAILED", createdAt: { gte: dayAgo } } }), 0),
    safe(prisma.outboundMessage.count({ where: { status: "QUEUED" } }), 0),
    safe(prisma.outboundMessage.count({ where: { status: "SENT", createdAt: { gte: dayAgo } } }), 0),
    safe(
      prisma.outboundMessage.findMany({
        where: { status: "FAILED", createdAt: { gte: weekAgo } },
        orderBy: { createdAt: "desc" },
        take: WIDGET_ROWS,
        select: { id: true, event: true, channel: true, error: true, createdAt: true },
      }),
      [],
    ),
    safe(prisma.scheduledJob.findMany(), []),
    safe(missingApiKeyServices(), [] as string[]),
    safe(prisma.user.count({ where: { role: "USER" } }), 0),
    safe(prisma.user.count({ where: { role: "USER", createdAt: { gte: startOfToday } } }), 0),
    safe(prisma.user.count({ where: { role: "USER", createdAt: { gte: weekAgo } } }), 0),
    safe(prisma.product.count({ where: { status: "APPROVED", privateOwnerId: null } }), 0),
    safe(prisma.registration.count({ where: { createdAt: { gte: startOfToday } } }), 0),
  ]);

  const rowByKey = new Map(jobRows.map((row) => [row.key, row]));
  const jobs = JOBS.map((job) => {
    const row = rowByKey.get(job.key);
    return {
      key: job.key,
      name: job.name,
      enabled: row?.enabled ?? true,
      lastRunAt: row?.lastRunAt ?? null,
      lastStatus: row?.lastStatus ?? null,
      lastMessage: row?.lastMessage ?? null,
    };
  });

  return {
    counts: {
      support,
      pendingProducts,
      uncertainties,
      bugReports,
      pendingImages,
      pendingLogos,
      qualityControl: qualityChecks + nutritionReports,
      duplicates,
      ingredientRequests,
      scanSubmissions,
      scanMessages,
    },
    latestSupport,
    latestProducts,
    latestBugReports,
    messages: {
      failed24h: failedMessages,
      queued: queuedMessages,
      sent24h: sentMessages,
      recentFailed: recentFailedMessages,
    },
    jobs,
    missingApiKeys,
    stats: { totalUsers, newUsersToday, newUsersWeek, approvedProducts, registrationsToday },
  };
}

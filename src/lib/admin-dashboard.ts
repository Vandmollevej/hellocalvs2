import { prisma } from "@/lib/prisma";
import { countSupportInbox } from "@/lib/support-inbox";
import { listUncertainties } from "@/lib/uncertainties";
import { QUALITY_CONTROL_PHOTO_TYPES } from "@/lib/quality-control-photo-types";

// Data til admin-oversigten (docs/DECISIONS.md 2026-09-27): tællere for alle
// ventende opgaver + de seneste supportsager, produkter og fejlrapporter.
// Hver kilde fejler for sig, så én langsom/fejlende tabel ikke vælter siden.

const WIDGET_ROWS = 6;

function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return promise.catch(() => fallback);
}

export async function loadAdminDashboard() {
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
  ] = await Promise.all([
    safe(countSupportInbox(), { unanswered: 0, overdue: 0 }),
    safe(prisma.product.count({ where: { status: "PENDING", privateOwnerId: null } }), 0),
    safe(
      listUncertainties().then((rows) => ({ total: rows.length, urgent: rows.filter((row) => row.urgent).length })),
      { total: 0, urgent: 0 },
    ),
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
    safe(prisma.productDuplicateLink.count({ where: { status: "PENDING" } }), 0),
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
  ]);

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
    },
    latestSupport,
    latestProducts,
    latestBugReports,
  };
}

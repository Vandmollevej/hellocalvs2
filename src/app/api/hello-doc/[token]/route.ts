import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { groupByDay } from "@/lib/daily-totals";
import { historyRangeToDays, isDoctorSharePendingExpired, sanitizeDoctorShareCategories } from "@/lib/doctor-share";

// The real, login-free view a doctor/dietitian opens from the invitation
// e-mail's link (docs/STATUS.md "Next work" #12A, docs/DECISIONS.md
// 2026-09-12). Deliberately unauthenticated by session, same
// unguessable-token pattern as Product.approvalToken/the admin mail-approval
// link — the DoctorShare.token in the URL *is* the access control. No
// getSessionUser() call anywhere in this route on purpose.
//
// PENDING shares never return the owner's actual health data — only enough
// to render the "do you want to accept this invitation?" screen. Data is
// only served once status is ACTIVE, i.e. after POST (accept) below.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const share = await prisma.doctorShare.findUnique({
    where: { token },
    include: { owner: true },
  });

  if (!share) return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });

  let status = share.status;
  if (isDoctorSharePendingExpired(share)) {
    status = "EXPIRED";
    await prisma.doctorShare.update({ where: { id: share.id }, data: { status: "EXPIRED" } });
  }

  const ownerName = share.owner.displayName;
  const doctorName = share.name;

  if (status === "REVOKED" || status === "EXPIRED") {
    return NextResponse.json({ status, ownerName, doctorName });
  }

  if (status === "PENDING") {
    return NextResponse.json({
      status,
      ownerName,
      doctorName,
      categories: sanitizeDoctorShareCategories(share.categories),
      historyRange: share.historyRange,
      expiresAt: share.expiresAt,
    });
  }

  // ACTIVE: serve the owner's data, scoped to exactly what they opted to
  // share (categories) and for how far back (historyRange) — never the
  // owner's full history, and never a category they didn't select.
  const categories = sanitizeDoctorShareCategories(share.categories);
  const days = historyRangeToDays(share.historyRange);
  const cutoff = days === null ? null : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const owner = share.owner;

  const needsNutrition = categories.includes("foodAndCalories") || categories.includes("vitaminsMinerals");
  const needsWeight = categories.includes("weight");
  const needsFluid = categories.includes("fluid");

  const [registrations, weightEntries, waterMetrics] = await Promise.all([
    needsNutrition
      ? prisma.registration.findMany({
          where: { userId: owner.id, ...(cutoff ? { createdAt: { gte: cutoff } } : {}) },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    needsWeight
      ? prisma.weightEntry.findMany({
          where: { userId: owner.id, ...(cutoff ? { weighedAt: { gte: cutoff } } : {}) },
          orderBy: { weighedAt: "asc" },
        })
      : Promise.resolve([]),
    needsFluid
      ? prisma.healthMetric.findMany({
          where: { userId: owner.id, type: "WATER_ML", ...(cutoff ? { recordedAt: { gte: cutoff } } : {}) },
          orderBy: { recordedAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const dailyNutrition = needsNutrition
    ? groupByDay(
        registrations.map((r) => ({
          kcalSnapshot: r.kcalSnapshot,
          proteinSnapshot: r.proteinSnapshot,
          carbsSnapshot: r.carbsSnapshot,
          fatSnapshot: r.fatSnapshot,
          sugarSnapshot: r.sugarSnapshot,
          fiberSnapshot: r.fiberSnapshot,
          saltSnapshot: r.saltSnapshot,
          potassiumSnapshot: r.potassiumSnapshot,
          calciumSnapshot: r.calciumSnapshot,
          ironSnapshot: r.ironSnapshot,
          vitaminASnapshot: r.vitaminASnapshot,
          vitaminCSnapshot: r.vitaminCSnapshot,
          createdAt: r.createdAt.toISOString(),
        }))
      )
    : [];

  return NextResponse.json({
    status,
    ownerName,
    doctorName,
    categories,
    historyRange: share.historyRange,
    profile: categories.includes("profile")
      ? { displayName: owner.displayName, email: owner.email, sex: owner.sex }
      : null,
    weight: categories.includes("weight")
      ? {
          startWeightKg: owner.weightKg,
          startWeightRecordedAt: owner.createdAt,
          history: weightEntries.map((entry) => ({ date: entry.weighedAt, weightKg: entry.weightKg })),
        }
      : null,
    goals: categories.includes("goals") ? { targetWeightKg: owner.targetWeightKg } : null,
    sleep: categories.includes("sleep")
      ? { defaultBedtime: owner.defaultBedtime, defaultWakeTime: owner.defaultWakeTime }
      : null,
    dailyNutrition: needsNutrition ? dailyNutrition : null,
    fluidHistory: categories.includes("fluid")
      ? waterMetrics.map((metric) => ({ date: metric.recordedAt, valueMl: metric.value }))
      : null,
  });
}

// Recipient taps "Bekræft og se data" on the pending-invitation screen —
// the one real acceptance step this feature was missing (see
// docs/DECISIONS.md 2026-09-12): flips PENDING -> ACTIVE and stamps
// acceptedAt. Only valid while still PENDING and not expired.
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const share = await prisma.doctorShare.findUnique({ where: { token } });
  if (!share) return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });

  if (share.status !== "PENDING") {
    return NextResponse.json({ status: share.status });
  }
  if (isDoctorSharePendingExpired(share)) {
    await prisma.doctorShare.update({ where: { id: share.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ status: "EXPIRED" });
  }

  const updated = await prisma.doctorShare.update({
    where: { id: share.id },
    data: { status: "ACTIVE", acceptedAt: new Date() },
  });

  return NextResponse.json({ status: updated.status });
}

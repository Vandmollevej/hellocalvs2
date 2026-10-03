import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";

// GET /api/health-metrics — reads data submitted via
// POST /api/integrations/healthkit/ingest (see docs/HEALTHKIT_COMPANION.md).
// Used by Statistics for the steps/water/burned cards (src/lib/stat-cards.ts).
const RECENT_DAYS = 120;
const MAX_RECENT = 10000;

export async function GET() {
  try {
    const user = await getProfileUser("healthMetrics", "VIEWED");

    if (!user) return unauthorized();
    // Alle målinger fra de seneste 120 dage, plus den nyeste ældre måling af
    // hver type, så fx fedtprocent fra en sjælden vejning stadig vises
    // (2026-10-03: integrationerne leverer nu langt flere typer pr. dag).
    const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
    const [recent, olderLatest] = await Promise.all([
      prisma.healthMetric.findMany({
        where: { userId: user.id, recordedAt: { gte: cutoff } },
        orderBy: { recordedAt: "desc" },
        take: MAX_RECENT,
      }),
      prisma.healthMetric.groupBy({
        by: ["type"],
        where: { userId: user.id, recordedAt: { lt: cutoff } },
        _max: { recordedAt: true },
      }),
    ]);
    const missing = olderLatest.filter((row) => row._max.recordedAt && !recent.some((m) => m.type === row.type));
    const older = missing.length
      ? await prisma.healthMetric.findMany({
          where: { userId: user.id, OR: missing.map((row) => ({ type: row.type, recordedAt: row._max.recordedAt as Date })) },
        })
      : [];
    return NextResponse.json({ metrics: [...recent, ...older] });
  } catch (error) {
    console.error("Health metric list failed", error);
    return NextResponse.json({ metrics: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

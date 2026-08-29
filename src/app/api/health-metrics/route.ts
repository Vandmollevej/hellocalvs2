import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

// GET /api/health-metrics — læsning af data indsendt via
// POST /api/integrations/healthkit/ingest (se docs/HEALTHKIT_COMPANION.md).
// Bruges af Statistik til steps/vand/forbrændt-kortene (src/lib/stat-cards.ts).
export async function GET() {
  try {
    const user = await getDemoUser();
    const metrics = await prisma.healthMetric.findMany({
      where: { userId: user.id },
      orderBy: { recordedAt: "desc" },
      take: 2000,
    });
    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Health metric list failed", error);
    return NextResponse.json({ metrics: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

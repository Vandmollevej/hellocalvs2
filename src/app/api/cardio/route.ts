import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { CARDIO_METRICS, CARDIO_TYPES } from "@/lib/cardio";
import type { HealthMetricType } from "@prisma/client";

// GET /api/cardio?days=90 (0 = alt) — cardio-målinger fra smartur og manuel indtastning.
export async function GET(req: Request) {
  try {
    const user = await getProfileUser("healthMetrics", "VIEWED");
    if (!user) return unauthorized();
    const days = Math.max(0, Math.min(3650, Number(new URL(req.url).searchParams.get("days")) || 0));
    const metrics = await prisma.healthMetric.findMany({
      where: {
        userId: user.id,
        type: { in: CARDIO_TYPES as HealthMetricType[] },
        ...(days ? { recordedAt: { gte: new Date(Date.now() - days * 86400000) } } : {}),
      },
      orderBy: { recordedAt: "asc" },
      take: 20000,
    });
    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Cardio list failed", error);
    return NextResponse.json({ metrics: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// POST /api/cardio { type, value, recordedAt? } — manuel indtastning (samme dag overskrives).
export async function POST(req: Request) {
  try {
    const user = await getProfileUser("healthMetrics", "CREATED");
    if (!user) return unauthorized();
    const body = (await req.json().catch(() => ({}))) as { type?: string; value?: number; recordedAt?: string };
    const def = CARDIO_METRICS.find((m) => m.type === body.type);
    const value = Number(body.value);
    if (!def || !Number.isFinite(value) || value < def.min || value > def.max) {
      return NextResponse.json({ message: "Ugyldig måling" }, { status: 400 });
    }
    const when = body.recordedAt ? new Date(body.recordedAt) : new Date();
    if (Number.isNaN(when.getTime()) || when.getTime() > Date.now() + 3600000) {
      return NextResponse.json({ message: "recordedAt er ugyldig" }, { status: 400 });
    }
    // Én manuel værdi pr. type og dag: kl. 12.00 UTC den dag.
    const recordedAt = new Date(`${when.toISOString().slice(0, 10)}T12:00:00.000Z`);
    const metric = await prisma.healthMetric.upsert({
      where: { userId_source_type_recordedAt: { userId: user.id, source: "MANUAL", type: def.type, recordedAt } },
      update: { value },
      create: { userId: user.id, source: "MANUAL", type: def.type, value, recordedAt },
    });
    return NextResponse.json({ metric });
  } catch (error) {
    console.error("Cardio save failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { INTEGRATION_CATALOG } from "@/lib/integrations";
import { BODY_METRIC_TYPES, SAME_MEASUREMENT_MS } from "@/lib/body-metrics";
import type { HealthMetricSource, HealthMetricType } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// Synkroniserede vejninger (fx fra en smartvægt) kan hverken rettes eller
// slettes i Hello Cal (brugerkrav 2026-10-03) — kun indtastede.
function lockedResponse() {
  return NextResponse.json({ message: "Synkroniserede vejninger kan ikke ændres eller slettes" }, { status: 403 });
}

// Vejningen + hvor den kommer fra + alle målinger fra samme vejning
// (fedtprocent, muskelmasse, …), til info-vinduet på vejningslisten.
export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const user = await getProfileUser("weight", "VIEWED");

    if (!user) return unauthorized();
    const entry = await prisma.weightEntry.findFirst({ where: { id, userId: user.id } });
    if (!entry) return NextResponse.json({ message: "Vejningen findes ikke" }, { status: 404 });

    if (entry.source === "MANUAL") return NextResponse.json({ entry, source: null, metrics: [] });

    const meta = INTEGRATION_CATALOG.find((item) => item.provider === entry.source);
    const metrics = await prisma.healthMetric.findMany({
      where: {
        userId: user.id,
        source: entry.source as HealthMetricSource,
        type: { in: BODY_METRIC_TYPES as HealthMetricType[] },
        recordedAt: {
          gte: new Date(entry.weighedAt.getTime() - SAME_MEASUREMENT_MS),
          lte: new Date(entry.weighedAt.getTime() + SAME_MEASUREMENT_MS),
        },
      },
      orderBy: { recordedAt: "asc" },
      select: { type: true, value: true },
    });

    return NextResponse.json({
      entry,
      source: { label: meta?.label ?? entry.source, icon: meta?.icon ?? null },
      metrics,
    });
  } catch (error) {
    console.error("Weight entry lookup failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const { weightKg } = (await req.json()) as { weightKg: number };

  if (!weightKg || weightKg <= 0) {
    return NextResponse.json({ message: "weightKg (> 0) er påkrævet" }, { status: 400 });
  }

  try {
    const user = await getProfileUser("weight", "UPDATED");

    if (!user) return unauthorized();
    const existing = await prisma.weightEntry.findFirst({ where: { id, userId: user.id }, select: { source: true } });
    if (existing && existing.source !== "MANUAL") return lockedResponse();
    const result = await prisma.weightEntry.updateMany({
      where: { id, userId: user.id, source: "MANUAL" },
      data: { weightKg },
    });

    if (result.count === 0) {
      return NextResponse.json({ message: "Vejningen findes ikke" }, { status: 404 });
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("Weight entry update failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const user = await getProfileUser("weight", "DELETED");

    if (!user) return unauthorized();
    const existing = await prisma.weightEntry.findFirst({ where: { id, userId: user.id }, select: { source: true } });
    if (existing && existing.source !== "MANUAL") return lockedResponse();
    const result = await prisma.weightEntry.deleteMany({
      where: { id, userId: user.id, source: "MANUAL" },
    });

    if (result.count === 0) {
      return NextResponse.json({ message: "Vejningen findes ikke" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Weight entry delete failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  ANALYTICS_METRICS,
  bucketMidpoint,
  isAgeBand,
  isBucket,
  SEXES,
  type AnalyticsMetric,
} from "@/lib/analytics-rules";

// POST { day, ageBand, sex, values: { kcal?: bucket, … } } — anonym
// statistik for én dag (docs/PRIVACY.md "Statistik").
//
// Gemmer KUN grupperede tællinger. Ingen IP, ingen bruger, ingen session.
// Landet kommer fra kontoens regionsindstilling. Sessionen bruges kun til at
// afvise anonyme indsendelser og til at tælle hver konto højst én gang pr.
// dag — via et kortlivet hash i hukommelsen, der aldrig gemmes.
const seen = new Map<string, number>();
const SEEN_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function alreadySubmitted(userId: string, day: string): boolean {
  const now = Date.now();
  for (const [k, at] of seen) if (now - at > SEEN_TTL_MS) seen.delete(k);
  const key = createHash("sha256").update(`${userId}:${day}`).digest("base64url");
  if (seen.has(key)) return true;
  seen.set(key, now);
  return false;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 204 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const day = typeof body?.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : null;
  const ageBand = isAgeBand(body?.ageBand) ? (body!.ageBand as string) : null;
  const sex = (SEXES as readonly string[]).includes(body?.sex as string) ? (body!.sex as string) : null;
  const values = body?.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : null;
  if (!day || !ageBand || !sex || !values) return NextResponse.json({ message: "Ugyldig statistik" }, { status: 400 });

  // Kun gårsdagen eller tidligere, højst 7 dage tilbage.
  const dayMs = new Date(`${day}T00:00:00.000Z`).getTime();
  const todayMs = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").getTime();
  if (!(dayMs < todayMs && todayMs - dayMs <= 7 * 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ message: "Ugyldig dag" }, { status: 400 });
  }
  if (alreadySubmitted(user.id, day)) return new NextResponse(null, { status: 204 });

  const rows = (Object.keys(ANALYTICS_METRICS) as AnalyticsMetric[])
    .filter((metric) => isBucket(metric, values[metric]))
    .map((metric) => ({ metric, bucket: values[metric] as string }));

  const date = new Date(`${day}T00:00:00.000Z`);
  const country = /^[A-Z]{2}$/.test(user.region) ? user.region : "XX";
  await prisma.$transaction(
    rows.map(({ metric, bucket }) =>
      prisma.analyticsBucket.upsert({
        where: { day_country_ageBand_sex_metric_bucket: { day: date, country, ageBand, sex, metric, bucket } },
        create: { day: date, country, ageBand, sex, metric, bucket, count: 1, sum: bucketMidpoint(bucket) },
        update: { count: { increment: 1 }, sum: { increment: bucketMidpoint(bucket) } },
      })
    )
  );
  return new NextResponse(null, { status: 204 });
}

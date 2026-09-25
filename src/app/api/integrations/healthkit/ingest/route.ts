import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashDeviceToken } from "@/lib/device-tokens";
import { deliverToInbox, type InboxEnvelope } from "@/lib/vault/inbox-delivery";

type IngestBody = {
  source?: "APPLE_HEALTH" | "HEALTH_CONNECT" | "GOOGLE_HEALTH";
  metrics?: { type?: string; value?: number; recordedAt?: string }[];
  weights?: { weightKg?: number; weighedAt?: string }[];
  activities?: {
    sportType?: string;
    startedAt?: string;
    durationMinutes?: number;
    caloriesBurned?: number;
  }[];
};

async function authenticate(req: Request) {
  const auth = req.headers.get("authorization");
  const raw = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!raw) return null;
  const token = await prisma.deviceToken.findUnique({ where: { tokenHash: hashDeviceToken(raw) } });
  if (!token) return null;
  await prisma.deviceToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  return token;
}

function validDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// POST — companion-appen (HealthKit/Health Connect) sender data med sit
// enhedstoken. Data forsegles straks til brugerens indbakke og gemmes aldrig
// i klartekst (docs/PRIVACY.md). Klienten flytter dem ind i boksen.
export async function POST(req: Request) {
  const token = await authenticate(req);
  if (!token) return NextResponse.json({ message: "Ugyldigt eller manglende enhedstoken" }, { status: 401 });
  if (!token.inboxId) return NextResponse.json({ message: "Enhedstokenet mangler en indbakke" }, { status: 409 });

  const body = (await req.json().catch(() => ({}))) as IngestBody;
  // GOOGLE_HEALTH var det tidligere navn for Health Connect; det betyder nu
  // Google Health API (cloud) og modtages derfor som HEALTH_CONNECT.
  const source = body.source === "GOOGLE_HEALTH" ? "HEALTH_CONNECT" : body.source;
  if (source !== "APPLE_HEALTH" && source !== "HEALTH_CONNECT") {
    return NextResponse.json({ message: "source skal være APPLE_HEALTH eller HEALTH_CONNECT" }, { status: 400 });
  }

  const items: InboxEnvelope[] = [];
  for (const m of body.metrics ?? []) {
    const recordedAt = validDate(m.recordedAt);
    if (m.type && typeof m.value === "number" && recordedAt) {
      items.push({ kind: "metric", payload: { source, type: m.type, value: m.value, recordedAt } });
    }
  }
  for (const w of body.weights ?? []) {
    const weighedAt = validDate(w.weighedAt);
    if (w.weightKg && weighedAt) items.push({ kind: "weight", payload: { source, weightKg: w.weightKg, weighedAt } });
  }
  for (const a of body.activities ?? []) {
    const startedAt = validDate(a.startedAt);
    if (a.sportType && startedAt && a.durationMinutes && a.caloriesBurned) {
      items.push({
        kind: "activity",
        payload: { source, sportType: a.sportType, startedAt, durationMinutes: a.durationMinutes, caloriesBurned: a.caloriesBurned },
      });
    }
  }

  try {
    const delivered = await deliverToInbox(token.inboxId, items);
    return NextResponse.json({ ok: true, delivered });
  } catch (error) {
    console.error("HealthKit ingest failed", error instanceof Error ? error.message : "ukendt");
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

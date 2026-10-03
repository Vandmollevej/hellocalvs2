import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeIntegrationItems, type IntegrationItem } from "@/lib/integrations/store-items";
import { authenticateDeviceToken, companionIntegration, companionSource } from "@/lib/integrations/companion";
import { filterItemsBySettings } from "@/lib/integrations/sync-settings";
import { brandForOrigin, type ViaBrand } from "@/lib/integrations/origins";
import { recordIntegrationEvent } from "@/lib/integrations/events";

type IngestBody = {
  source?: "APPLE_HEALTH" | "HEALTH_CONNECT" | "GOOGLE_HEALTH";
  // origin (valgfri på hver post): afsender-appens pakke-/bundle-ID.
  metrics?: { type?: string; value?: number; recordedAt?: string; origin?: string }[];
  weights?: { weightKg?: number; weighedAt?: string; origin?: string }[];
  activities?: {
    sportType?: string;
    startedAt?: string;
    durationMinutes?: number;
    caloriesBurned?: number;
    origin?: string;
  }[];
};

function validDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// POST — companion-appen (HealthKit/Health Connect) sender data med sit
// enhedstoken. Data gemmes direkte på tokenets bruger.
export async function POST(req: Request) {
  const token = await authenticateDeviceToken(req);
  if (!token) return NextResponse.json({ message: "Ugyldigt eller manglende enhedstoken" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as IngestBody;
  const source = companionSource(body.source);
  if (!source) {
    return NextResponse.json({ message: "source skal være APPLE_HEALTH eller HEALTH_CONNECT" }, { status: 400 });
  }

  const items: IntegrationItem[] = [];
  // Mærker (Samsung Health, Renpho, eufy …), hvis app har delt data hertil.
  const brands = new Set<ViaBrand>();
  for (const entry of [...(body.metrics ?? []), ...(body.weights ?? []), ...(body.activities ?? [])]) {
    const brand = brandForOrigin(entry.origin);
    if (brand) brands.add(brand);
  }
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
    // 0 kcal er gyldigt (fx gåture uden pulsmåler); kun varighed er påkrævet.
    if (a.sportType && startedAt && a.durationMinutes && a.durationMinutes > 0) {
      items.push({
        kind: "activity",
        payload: { source, sportType: a.sportType, startedAt, durationMinutes: a.durationMinutes, caloriesBurned: a.caloriesBurned ?? 0 },
      });
    }
  }

  try {
    // Kun de datatyper, brugeren har slået til under "Hent fra" på appens side.
    const integration = await companionIntegration(token.userId, source);
    const delivered = await storeIntegrationItems(token.userId, filterItemsBySettings(source, integration.syncSettings, items));
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "CONNECTED", connectedAt: integration.connectedAt ?? new Date(), lastSyncedAt: new Date(), lastError: null },
    });
    // Mærkets kort viser "Forbundet" og hvornår data sidst kom ind.
    for (const provider of brands) {
      const now = new Date();
      await prisma.integration.upsert({
        where: { userId_provider: { userId: token.userId, provider } },
        create: { userId: token.userId, provider, status: "CONNECTED", connectedAt: now, lastSyncedAt: now, scope: `via:${source}` },
        update: { status: "CONNECTED", lastSyncedAt: now, scope: `via:${source}` },
      });
    }
    await recordIntegrationEvent(token.userId, source, "SYNC", delivered);
    return NextResponse.json({ ok: true, delivered });
  } catch (error) {
    console.error("HealthKit ingest failed", error instanceof Error ? error.message : "ukendt");
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

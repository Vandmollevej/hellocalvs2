import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScanWorker } from "@/lib/scan/require-worker";
import { lookupStoreName, saveShelfPhoto } from "@/lib/scan/storage";
import { parseLocation } from "@/lib/scan/submissions";
import { analyzeShelfPhoto } from "@/lib/scan/shelf-analysis";
import { SHELF_PHOTO_SELECT } from "@/lib/scan/shelf-select";

// Alle medarbejderens hyldebilleder, nyeste først (swipe-historik).
export async function GET() {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const photos = await prisma.shelfPhoto.findMany({
    where: { workerId: worker.id },
    orderBy: { capturedAt: "desc" },
    select: SHELF_PHOTO_SELECT,
  });
  return NextResponse.json({ photos });
}

// Nyt hyldebillede med præcise koordinater. Analysen (OpenAI Vision +
// databasematch) kører bagefter; klienten poller GET /api/scan/shelf-photos/[id].
export async function POST(req: Request) {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const location = parseLocation(body);
  if (!location) return NextResponse.json({ message: "Lokation mangler" }, { status: 400 });
  const imageUrl = typeof body.photo === "string" ? await saveShelfPhoto(body.photo) : null;
  if (!imageUrl) return NextResponse.json({ message: "Ugyldigt billede" }, { status: 400 });

  const photo = await prisma.shelfPhoto.create({
    data: {
      workerId: worker.id,
      imageUrl,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyM: location.accuracyM,
      capturedAt: location.capturedAt,
      storeName: await lookupStoreName(location.latitude, location.longitude),
    },
    select: SHELF_PHOTO_SELECT,
  });
  after(() => analyzeShelfPhoto(photo.id));
  return NextResponse.json({ photo }, { status: 201 });
}

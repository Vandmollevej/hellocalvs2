import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { isMigrationSource, latestDate } from "@/lib/migration-import";
import { extractDiaryFrame } from "@/lib/migration-import-ai";

const MAX_FRAMES = 400;
const MAX_PHOTO_CHARS = 3_000_000;

// Ét billede fra skærmoptagelsen ad gangen: AI aflæser det, og de nye rækker
// gemmes (dubletter fra tidligere billeder springes over af unik-nøglen).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const found = await prisma.migrationImport.findFirst({ where: { id, userId: user.id } });
  if (!found || !isMigrationSource(found.source)) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  if (found.frameCount >= MAX_FRAMES) {
    return NextResponse.json({ message: "Optagelsen er for lang — del den op i flere importer" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { photo?: unknown; contextDate?: unknown; today?: unknown } | null;
  const photo = typeof body?.photo === "string" ? body.photo : "";
  if (!photo.startsWith("data:image/") || photo.length > MAX_PHOTO_CHARS) {
    return NextResponse.json({ message: "Ugyldigt billede" }, { status: 400 });
  }
  const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const today = isDate(body?.today) ? body.today : new Date().toISOString().slice(0, 10);
  const contextDate = isDate(body?.contextDate) ? body.contextDate : null;

  try {
    const { screenDate, rows } = await extractDiaryFrame({ photo, source: found.source, today, contextDate });
    const added = rows.length
      ? await prisma.migrationImportRow.createMany({
          data: rows.map((row) => ({ ...row, importId: id })),
          skipDuplicates: true,
        })
      : { count: 0 };
    await prisma.migrationImport.update({ where: { id }, data: { frameCount: { increment: 1 } } });
    return NextResponse.json({ added: added.count, read: rows.length, date: latestDate(rows, screenDate) });
  } catch (error) {
    console.error("Migration frame failed", error);
    return NextResponse.json({ message: "Billedet kunne ikke aflæses" }, { status: 502 });
  }
}

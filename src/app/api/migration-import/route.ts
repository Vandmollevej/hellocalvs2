import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { isMigrationSource } from "@/lib/migration-import";

// Migrering fra MyFitnessPal / Lifesum (docs/DECISIONS.md 2026-10-06).
// GET: brugerens seneste importer. POST: start en ny import.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const imports = await prisma.migrationImport.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { _count: { select: { rows: true } } },
  });
  return NextResponse.json({ imports });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as { source?: unknown } | null;
  if (!isMigrationSource(body?.source)) {
    return NextResponse.json({ message: "Vælg MyFitnessPal eller Lifesum" }, { status: 400 });
  }
  const created = await prisma.migrationImport.create({ data: { userId: user.id, source: body.source } });
  return NextResponse.json({ import: created });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { normalizeMeal, registrationTime } from "@/lib/migration-import";

// Importér de valgte rækker som registreringer i Hello Cal. Snapshot-værdier
// er rækkens egne tal (som i den anden app); der oprettes ingen varer.
// Fravalgte rækker markeres SKIPPED, så importen kan afsluttes.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const found = await prisma.migrationImport.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!found) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { rowIds?: unknown } | null;
  const rowIds = Array.isArray(body?.rowIds) ? body.rowIds.filter((value): value is string => typeof value === "string") : [];

  const rows = await prisma.migrationImportRow.findMany({
    where: { importId: id, status: "PENDING", id: { in: rowIds } },
  });

  let imported = 0;
  for (const row of rows) {
    await prisma.$transaction(async (tx) => {
      const registration = await tx.registration.create({
        data: {
          userId: user.id,
          titleSnapshot: row.name,
          kcalSnapshot: row.kcal,
          proteinSnapshot: row.protein ?? 0,
          carbsSnapshot: row.carbs ?? 0,
          fatSnapshot: row.fat ?? 0,
          amountGrams: row.amountGrams ?? 0,
          createdAt: registrationTime(row.date, normalizeMeal(row.meal)),
        },
      });
      await tx.migrationImportRow.update({
        where: { id: row.id },
        data: { status: "IMPORTED", registrationId: registration.id },
      });
    });
    imported += 1;
  }

  await prisma.migrationImportRow.updateMany({
    where: { importId: id, status: "PENDING", id: { notIn: rowIds } },
    data: { status: "SKIPPED" },
  });
  await prisma.migrationImport.update({ where: { id }, data: { status: "DONE" } });
  return NextResponse.json({ imported });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { BugReportCategory } from "@prisma/client";

const BUG_REPORT_CATEGORIES = Object.values(BugReportCategory);

function parseCategories(body: Record<string, unknown>): BugReportCategory[] {
  if (!Array.isArray(body.categories)) return [];
  return body.categories.filter((c): c is BugReportCategory =>
    typeof c === "string" && (BUG_REPORT_CATEGORIES as string[]).includes(c)
  );
}

// Lets a user edit their own still-PENDING report from the "Redigér" button
// on the "afventer gennemgang" overlay (docs/DECISIONS.md 2026-09-19) —
// updates the existing row in place rather than creating a second one.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Log ind for at redigere din indberetning" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.bugReport.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ message: "Indberetningen findes ikke" }, { status: 404 });
  }
  if (existing.status !== "PENDING") {
    return NextResponse.json({ message: "Denne indberetning er allerede behandlet" }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description || description.length < 10) {
    return NextResponse.json(
      { message: "Beskriv fejlen med mindst 10 tegn, så vi kan følge op" },
      { status: 400 }
    );
  }

  const categories = parseCategories(body);

  const bugReport = await prisma.bugReport.update({
    where: { id },
    data: { description, categories },
  });

  return NextResponse.json({ bugReport });
}

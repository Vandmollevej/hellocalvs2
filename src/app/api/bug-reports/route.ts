import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// "Indberet fejl" (docs/DECISIONS.md 2026-09-02): 10 points ved godkendelse,
// se src/lib/bug-report-approval.ts. Kræver en rigtig session — en
// fejlrapport uden kendt afsender giver ingen mening (og ingen at kreditere
// points).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Log ind for at indberette en fejl" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  const screenshotUrl = typeof body.screenshotUrl === "string" ? body.screenshotUrl : undefined;

  if (!description || description.length < 10) {
    return NextResponse.json(
      { message: "Beskriv fejlen med mindst 10 tegn, så vi kan følge op" },
      { status: 400 }
    );
  }

  const bugReport = await prisma.bugReport.create({
    data: { userId: user.id, description, screenshotUrl },
  });

  return NextResponse.json({ bugReport }, { status: 201 });
}

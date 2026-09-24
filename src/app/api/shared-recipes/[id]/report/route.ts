import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// Én anmeldelse pr. bruger og ret, kun i processens hukommelse — hvem der
// anmeldte hvad, gemmes aldrig (docs/PRIVACY.md).
const reported = new Set<string>();

// POST — anmeld en delt ret. Kun muligt, indtil admin har godkendt den.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const { id } = await params;
  const key = `${user.id}:${id}`;
  if (reported.has(key)) return NextResponse.json({ reported: true });

  const { count } = await prisma.sharedRecipe.updateMany({
    where: { id, status: "PENDING" },
    data: { reportCount: { increment: 1 } },
  });
  if (count === 0) return NextResponse.json({ message: "Retten kan ikke anmeldes" }, { status: 409 });
  reported.add(key);
  return NextResponse.json({ reported: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { recordFlowEvent, type FlowEvent } from "@/lib/flows";

const EVENTS: FlowEvent[] = ["shown", "completed", "dismissed"];

// Et flow er vist / gennemført / lukket med "Vis ikke igen" for brugeren.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { event?: string } | null;
  const event = EVENTS.find((value) => value === body?.event);
  if (!event) return NextResponse.json({ message: "Ugyldig hændelse" }, { status: 400 });
  if (!(await prisma.flow.findUnique({ where: { id }, select: { id: true } }))) {
    return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  }
  await recordFlowEvent(user.id, id, event);
  return NextResponse.json({ ok: true });
}

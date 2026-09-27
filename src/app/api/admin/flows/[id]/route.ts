import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { deleteFlow, getFlow, parseFlowInput, saveFlow } from "@/lib/flows";

// Gem hele flowet (navn, til/fra og alle sider i rækkefølge) på én gang.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const input = parseFlowInput(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ message: "Ugyldigt flow" }, { status: 400 });
  if (!(await getFlow(id))) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  const flow = await saveFlow(id, input);
  return NextResponse.json({ flow });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await getFlow(id))) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  await deleteFlow(id);
  return NextResponse.json({ ok: true });
}

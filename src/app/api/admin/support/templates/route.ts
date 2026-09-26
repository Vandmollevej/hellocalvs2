import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_TEMPLATE_TITLE_MAX,
  cleanSupportText,
  deleteSupportReplyTemplate,
  listSupportReplyTemplates,
  saveSupportReplyTemplate,
} from "@/lib/support-inbox";

// Svarskabeloner til Support-indbakken (docs/DECISIONS.md 2026-09-26).
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ templates: await listSupportReplyTemplates() });
}

// Opret (uden id) eller ret (med id).
export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = cleanSupportText(body?.title, SUPPORT_TEMPLATE_TITLE_MAX);
  const text = cleanSupportText(body?.body, SUPPORT_MESSAGE_MAX);
  if (!title || !text) return NextResponse.json({ message: "Udfyld titel og tekst" }, { status: 400 });
  const sortOrder = typeof body?.sortOrder === "number" && Number.isFinite(body.sortOrder) ? Math.round(body.sortOrder) : 0;
  const id = typeof body?.id === "string" ? body.id : undefined;
  const saved = await saveSupportReplyTemplate({ id, title, body: text, sortOrder });
  if (!saved) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !(await deleteSupportReplyTemplate(id))) {
    return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

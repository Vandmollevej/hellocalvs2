import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { deleteSavedView, isSavedViewScope, listSavedViews, saveSavedView } from "@/lib/admin-saved-views";

// Admins gemte visninger (docs/DECISIONS.md 2026-10-07). Hver admin ser kun
// sine egne. GET ?scope=…, POST { scope, name, query }, DELETE ?id=…

export async function GET(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const scope = new URL(req.url).searchParams.get("scope");
  if (!isSavedViewScope(scope)) return NextResponse.json({ message: "Ugyldig side" }, { status: 400 });
  return NextResponse.json({ views: await listSavedViews(admin.id, scope) });
}

export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { scope?: unknown; name?: unknown; query?: unknown } | null;
  if (!body || !isSavedViewScope(body.scope) || typeof body.name !== "string" || typeof body.query !== "string") {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  if (!body.name.trim()) return NextResponse.json({ message: "Giv visningen et navn" }, { status: 400 });
  try {
    const view = await saveSavedView(admin.id, body.scope, body.name, body.query);
    return NextResponse.json({ view, views: await listSavedViews(admin.id, body.scope) });
  } catch (error) {
    console.error("Failed to save admin view", error);
    return NextResponse.json({ message: "Kunne ikke gemme" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  await deleteSavedView(admin.id, id);
  return NextResponse.json({ ok: true });
}

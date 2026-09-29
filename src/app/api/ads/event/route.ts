import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Registrerer en anonym reklame-visning eller -klik (docs/DECISIONS.md
// 2026-09-29). Ingen bruger-id gemmes; kun reklame, placering og type.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    adKey?: unknown;
    placement?: unknown;
    type?: unknown;
    country?: unknown;
  } | null;
  const adKey = typeof body?.adKey === "string" ? body.adKey.trim().slice(0, 100) : "";
  const type = body?.type === "IMPRESSION" || body?.type === "CLICK" ? body.type : null;
  if (!adKey || !type) return NextResponse.json({ error: "Ugyldig reklamehændelse" }, { status: 400 });

  await prisma.adEvent.create({
    data: {
      adKey,
      type,
      placement: typeof body?.placement === "string" ? body.placement.trim().slice(0, 100) : "",
      country: typeof body?.country === "string" ? body.country.trim().slice(0, 2).toUpperCase() || null : null,
    },
  });
  return NextResponse.json({ ok: true });
}

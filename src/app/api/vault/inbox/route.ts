import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { idFromSecretToken, INBOX_TOKEN_HEADER, isBase64Url } from "@/lib/vault/server";

// Indbakke for data, som serveren forsegler til boksen (docs/PRIVACY.md).
// Indbakken findes via x-inbox-token (id = SHA-256(token)); tokenet ligger
// krypteret i boksen, så indbakken kan ikke kobles til boksen af serveren.

async function inboxIdFrom(req: Request) {
  const user = await getSessionUser();
  if (!user) return { error: "Ikke logget ind", status: 401 } as const;
  const inboxId = idFromSecretToken(req.headers.get(INBOX_TOKEN_HEADER));
  if (!inboxId) return { error: "Ugyldig indbakke", status: 400 } as const;
  return { inboxId } as const;
}

// POST — opret indbakke { publicKey } (idempotent). Returnerer inboxId, som
// integrationen gemmer som leveringsadresse.
export async function POST(req: Request) {
  const r = await inboxIdFrom(req);
  if ("error" in r) return NextResponse.json({ message: r.error }, { status: r.status });
  const body = (await req.json().catch(() => null)) as { publicKey?: unknown } | null;
  if (!isBase64Url(body?.publicKey, 64)) {
    return NextResponse.json({ message: "publicKey mangler" }, { status: 400 });
  }
  await prisma.vaultInbox.upsert({
    where: { id: r.inboxId },
    update: {},
    create: { id: r.inboxId, publicKey: body!.publicKey as string },
  });
  return NextResponse.json({ inboxId: r.inboxId });
}

// GET — forseglede elementer, ældste først.
export async function GET(req: Request) {
  const r = await inboxIdFrom(req);
  if ("error" in r) return NextResponse.json({ message: r.error }, { status: r.status });
  const items = await prisma.vaultInboxItem.findMany({
    where: { inboxId: r.inboxId },
    select: { id: true, epk: true, iv: true, ciphertext: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return NextResponse.json({ items });
}

// DELETE — { ids: [...] } fjerner elementer, som klienten har flyttet ind i boksen.
export async function DELETE(req: Request) {
  const r = await inboxIdFrom(req);
  if ("error" in r) return NextResponse.json({ message: r.error }, { status: r.status });
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((id): id is string => typeof id === "string") : [];
  if (ids.length === 0) return NextResponse.json({ deleted: 0 });
  const result = await prisma.vaultInboxItem.deleteMany({ where: { inboxId: r.inboxId, id: { in: ids } } });
  return NextResponse.json({ deleted: result.count });
}

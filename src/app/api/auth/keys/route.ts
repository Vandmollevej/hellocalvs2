import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isBase64Url } from "@/lib/vault/server";

// Brugerens nøglekuverter (docs/PRIVACY.md "Nøglehierarki"). Serveren gemmer
// kun krypterede kuverter og kan ikke åbne dem.

// GET — hvilke passkeys har en kuvert, og findes der en gendannelseskuvert.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const [passkeys, envelopes, share] = await Promise.all([
    prisma.passkey.findMany({
      where: { userId: user.id },
      select: { credentialId: true, name: true, createdAt: true, lastUsedAt: true, backedUp: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.keyEnvelope.findMany({ where: { userId: user.id }, select: { kind: true, credentialId: true } }),
    prisma.recoveryShare.findUnique({ where: { userId: user.id }, select: { createdAt: true } }),
  ]);
  const withEnvelope = new Set(envelopes.filter((e) => e.kind === "PASSKEY_PRF").map((e) => e.credentialId));
  return NextResponse.json({
    passkeys: passkeys.map((p) => ({ ...p, hasEnvelope: withEnvelope.has(p.credentialId) })),
    hasRecovery: Boolean(share) && envelopes.some((e) => e.kind === "RECOVERY"),
    recoveryCreatedAt: share?.createdAt ?? null,
  });
}

// POST — { credentialId, iv, ciphertext }: kuvert for en af brugerens passkeys.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isBase64Url(body?.credentialId, 512) || !isBase64Url(body?.iv, 32) || !isBase64Url(body?.ciphertext, 256)) {
    return NextResponse.json({ message: "Ugyldig kuvert" }, { status: 400 });
  }
  const credentialId = body!.credentialId as string;
  const passkey = await prisma.passkey.findUnique({ where: { credentialId }, select: { userId: true } });
  if (!passkey || passkey.userId !== user.id) {
    return NextResponse.json({ message: "Ukendt passkey" }, { status: 404 });
  }
  const data = { iv: body!.iv as string, ciphertext: body!.ciphertext as string };
  await prisma.keyEnvelope.upsert({
    where: { credentialId },
    update: data,
    create: { userId: user.id, kind: "PASSKEY_PRF", credentialId, ...data },
  });
  return NextResponse.json({ ok: true });
}

// PUT — { serverShare, fileHash, iv, ciphertext }: ny gendannelsesnøgle.
// Erstatter en eventuel tidligere (den gamle fil holder op med at virke).
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    !isBase64Url(body?.serverShare, 64) ||
    !isBase64Url(body?.fileHash, 64) ||
    !isBase64Url(body?.iv, 32) ||
    !isBase64Url(body?.ciphertext, 256)
  ) {
    return NextResponse.json({ message: "Ugyldig gendannelsesnøgle" }, { status: 400 });
  }
  const share = { serverShare: body!.serverShare as string, fileHash: body!.fileHash as string };
  await prisma.$transaction([
    prisma.keyEnvelope.deleteMany({ where: { userId: user.id, kind: "RECOVERY" } }),
    prisma.keyEnvelope.create({
      data: { userId: user.id, kind: "RECOVERY", iv: body!.iv as string, ciphertext: body!.ciphertext as string },
    }),
    prisma.recoveryShare.upsert({
      where: { userId: user.id },
      update: { ...share, createdAt: new Date() },
      create: { userId: user.id, ...share },
    }),
  ]);
  return NextResponse.json({ ok: true });
}

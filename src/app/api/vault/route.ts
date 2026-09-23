import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { idFromSecretToken, isBase64Url, resolveVault, VAULT_TOKEN_HEADER } from "@/lib/vault/server";

// POST /api/vault — opretter brugerens boks (idempotent).
// Body: { publicKey } + header x-vault-token. Boksen får INGEN reference til
// kontoen (docs/PRIVACY.md).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const vaultId = idFromSecretToken(req.headers.get(VAULT_TOKEN_HEADER));
  if (!vaultId) return NextResponse.json({ message: "Ugyldig boks" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { publicKey?: unknown } | null;
  if (!isBase64Url(body?.publicKey, 64)) {
    return NextResponse.json({ message: "publicKey mangler" }, { status: 400 });
  }

  await prisma.vault.upsert({
    where: { id: vaultId },
    update: {},
    create: { id: vaultId, publicKey: body!.publicKey as string },
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/vault — sletter hele boksen (brugeren sletter sin konto).
export async function DELETE(req: Request) {
  const resolved = await resolveVault(req);
  if ("error" in resolved) return NextResponse.json({ message: resolved.error }, { status: resolved.status });
  await prisma.vault.delete({ where: { id: resolved.vaultId } });
  return NextResponse.json({ ok: true });
}

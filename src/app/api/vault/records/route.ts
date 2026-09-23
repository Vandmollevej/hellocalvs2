import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBase64Url, MAX_BATCH, MAX_CIPHERTEXT_CHARS, resolveVault } from "@/lib/vault/server";

// GET /api/vault/records?since=<ISO> — alle poster ændret efter `since`
// (inkl. slettede, så klienten kan fjerne dem). Uden `since`: hele boksen.
export async function GET(req: Request) {
  const resolved = await resolveVault(req);
  if ("error" in resolved) return NextResponse.json({ message: resolved.error }, { status: resolved.status });

  const sinceParam = new URL(req.url).searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : null;
  if (since && Number.isNaN(since.getTime())) {
    return NextResponse.json({ message: "since er ugyldig" }, { status: 400 });
  }

  const records = await prisma.vaultRecord.findMany({
    where: { vaultId: resolved.vaultId, ...(since ? { updatedAt: { gt: since } } : { deleted: false }) },
    select: { tag: true, recordId: true, iv: true, ciphertext: true, deleted: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
  });
  return NextResponse.json({
    records,
    serverTime: new Date().toISOString(),
  });
}

type IncomingRecord = { tag?: unknown; recordId?: unknown; iv?: unknown; ciphertext?: unknown; deleted?: unknown };

// PUT /api/vault/records — { records: [{ tag, recordId, iv, ciphertext, deleted? }] }
// Opretter eller overskriver poster (sidste skrivning vinder).
export async function PUT(req: Request) {
  const resolved = await resolveVault(req);
  if ("error" in resolved) return NextResponse.json({ message: resolved.error }, { status: resolved.status });

  const body = (await req.json().catch(() => null)) as { records?: IncomingRecord[] } | null;
  const incoming = Array.isArray(body?.records) ? body!.records : null;
  if (!incoming || incoming.length === 0 || incoming.length > MAX_BATCH) {
    return NextResponse.json({ message: `records skal have 1-${MAX_BATCH} poster` }, { status: 400 });
  }
  for (const r of incoming) {
    if (
      !isBase64Url(r.tag, 64) ||
      !isBase64Url(r.recordId, 64) ||
      !isBase64Url(r.iv, 32) ||
      !isBase64Url(r.ciphertext, MAX_CIPHERTEXT_CHARS)
    ) {
      return NextResponse.json({ message: "Ugyldig post" }, { status: 400 });
    }
  }

  const vaultId = resolved.vaultId;
  await prisma.$transaction(
    incoming.map((r) => {
      const data = {
        iv: r.iv as string,
        ciphertext: r.ciphertext as string,
        deleted: r.deleted === true,
      };
      return prisma.vaultRecord.upsert({
        where: { vaultId_tag_recordId: { vaultId, tag: r.tag as string, recordId: r.recordId as string } },
        update: data,
        create: { vaultId, tag: r.tag as string, recordId: r.recordId as string, ...data },
      });
    })
  );
  return NextResponse.json({ ok: true, serverTime: new Date().toISOString() });
}

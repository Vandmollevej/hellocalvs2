import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { MAX_BANNER_BYTES, storeAdBanner } from "@/lib/ad-banner-storage";

// Upload af et partnerbanner (docs/DECISIONS.md 2026-10-02). Multipart med
// feltet "file". Svarer med den gemte sti, som derefter sættes på spottet.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await prisma.partner.findUnique({ where: { id }, select: { id: true } }))) {
    return NextResponse.json({ message: "Partneren findes ikke" }, { status: 404 });
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BANNER_BYTES + 64 * 1024) return NextResponse.json({ message: "Billedet er for stort (højst 4 MB)" }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "Vælg en billedfil" }, { status: 400 });
  const result = await storeAdBanner(Buffer.from(await file.arrayBuffer()));
  if ("error" in result) return NextResponse.json({ message: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, url: result.url });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { saveDataUrlImage } from "@/lib/qc-image-storage";

// "Find nyt billede": admin trækker et nyt billede ind. Det gemmes som forslag
// (pendingImageUrl) og vises ved siden af det nuværende, til admin trykker Vælg.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { dataUrl?: string } | null;
  const url = body?.dataUrl ? await saveDataUrlImage(body.dataUrl) : null;
  if (!url) return NextResponse.json({ message: "Billedet kunne ikke læses (png, jpg eller webp)" }, { status: 400 });

  await prisma.product.update({ where: { id }, data: { pendingImageUrl: url, imageStatus: "PENDING", imageNeedsNew: true } });
  return NextResponse.json({ url });
}

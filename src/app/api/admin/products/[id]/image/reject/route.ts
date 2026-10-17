import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { resolveOpenSearches } from "@/lib/product-image-search";

// mode "keep": det nuværende billede beholdes, forslaget forkastes.
// mode "both" (Afvis): begge billeder afvises, og varen står under "Find nyt billede".
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { mode?: string } | null;
  const product = await prisma.product.update({
    where: { id },
    data: { pendingImageUrl: null, imageStatus: "REJECTED", imageNeedsNew: body?.mode === "both" },
  });
  await resolveOpenSearches(id);
  return NextResponse.json({ product });
}

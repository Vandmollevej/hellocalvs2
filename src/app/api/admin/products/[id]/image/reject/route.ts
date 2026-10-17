import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { resolveOpenSearches } from "@/lib/product-image-search";
import { isOpenAiCutoutUrl, retryCutoutWithOpenAi } from "@/lib/openai-cutout";

// Et billedkald til OpenAI kan tage op til ~2 minutter.
export const maxDuration = 120;

// mode "keep": det nuværende billede beholdes, forslaget forkastes.
// mode "both" (Afvis): begge billeder afvises, og varen står under "Find nyt billede".
// retryOpenAi (docs/DECISIONS.md 2026-10-17): første afvisning af et forslag, der ikke
// selv er fra OpenAI, sender originalfotoet til OpenAI og lægger resultatet som nyt
// forslag. Fejler kaldet, afvises forslaget som før.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { mode?: string; retryOpenAi?: boolean } | null;

  if (body?.retryOpenAi && body.mode !== "keep") {
    const existing = await prisma.product.findUnique({ where: { id }, select: { pendingImageUrl: true } });
    if (existing?.pendingImageUrl && !isOpenAiCutoutUrl(existing.pendingImageUrl)) {
      const retry = await retryCutoutWithOpenAi(id);
      if (retry.ok) {
        const product = await prisma.product.update({
          where: { id },
          data: { pendingImageUrl: retry.url, imageStatus: "PENDING" },
        });
        return NextResponse.json({ product, retried: true, pendingImageUrl: retry.url });
      }
    }
  }

  const product = await prisma.product.update({
    where: { id },
    data: { pendingImageUrl: null, imageStatus: "REJECTED", imageNeedsNew: body?.mode === "both" },
  });
  await resolveOpenSearches(id);
  return NextResponse.json({ product, retried: false });
}

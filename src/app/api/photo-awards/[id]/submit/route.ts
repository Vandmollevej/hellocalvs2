import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { saveDataUrlImage } from "@/lib/qc-image-storage";

// Bruger-indsendelse af et erstatningsbillede for en åben Award
// (docs/DECISIONS.md, 2026-09-19). Erstatter IKKE selv det gamle billede —
// sætter kun status=SUBMITTED og venter på admin-godkendelse
// (POST /api/admin/quality-control/[id]/award/resolve), samme
// "conditional, not automatic" princip som produktbilled-godkendelse.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  if (!photo.startsWith("data:image/")) {
    return NextResponse.json({ message: "photo er påkrævet" }, { status: 400 });
  }

  const award = await prisma.productPhotoAward.findUnique({ where: { id } });
  if (!award || !award.enabled || award.status !== "OPEN") {
    return NextResponse.json({ message: "Denne award kan ikke modtage et billede lige nu" }, { status: 400 });
  }

  const imageUrl = await saveDataUrlImage(photo).catch(() => null);
  if (!imageUrl) {
    return NextResponse.json({ message: "Kunne ikke gemme billedet" }, { status: 503 });
  }

  // Der er stadig intet generelt brugerlogin i denne app (se docs/STATUS.md) —
  // samme delte demo-bruger andre uautentificerede skriveveje bruger.
  const user = await getDemoUser();
  const updated = await prisma.productPhotoAward.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      submittedImageUrl: imageUrl,
      submittedByUserId: user.id,
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ award: updated });
}

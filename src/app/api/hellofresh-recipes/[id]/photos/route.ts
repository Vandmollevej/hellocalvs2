import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { MEAL_KIT_SOURCES } from "@/lib/meal-kit-providers";
import { HF_RECIPE_MAX_PHOTOS } from "@/lib/hellofresh-recipe";

// "Mine kogebogsbilleder" på en HelloFresh-opskrift (docs/DECISIONS.md
// 2026-09-27). Billedet sendes som nedskaleret data-URL
// (src/lib/image-downscale.ts), som retternes egne billeder.

const MAX_IMAGE_LENGTH = 3_000_000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getProfileUser("recipeFavorites", "CREATED");
  if (!user) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { image?: unknown } | null;
  const image = body?.image;
  if (typeof image !== "string" || !image.startsWith("data:image/") || image.length > MAX_IMAGE_LENGTH) {
    return NextResponse.json({ message: "Ugyldigt billede" }, { status: 400 });
  }
  const product = await prisma.product.findFirst({ where: { id, externalSource: { in: MEAL_KIT_SOURCES } }, select: { id: true } });
  if (!product) return NextResponse.json({ message: "Opskriften findes ikke" }, { status: 404 });
  const count = await prisma.recipeCookbookPhoto.count({ where: { userId: user.id, productId: id } });
  if (count >= HF_RECIPE_MAX_PHOTOS) return NextResponse.json({ message: "For mange billeder" }, { status: 400 });

  const photo = await prisma.recipeCookbookPhoto.create({
    data: { userId: user.id, productId: id, image },
    select: { id: true, image: true },
  });
  return NextResponse.json({ photo });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getProfileUser("recipeFavorites", "DELETED");
  if (!user) return unauthorized();
  const { id } = await params;
  const photoId = new URL(req.url).searchParams.get("photoId");
  if (!photoId) return NextResponse.json({ message: "photoId mangler" }, { status: 400 });
  await prisma.recipeCookbookPhoto.deleteMany({ where: { id: photoId, userId: user.id, productId: id } });
  return NextResponse.json({ ok: true });
}

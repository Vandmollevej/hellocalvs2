import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

const MAX_SECONDARY_IMAGES = 3;

// POST /api/admin/products/[id]/images { url } — add one of up to 3
// additional photos alongside the primary Product.imageUrl (e.g. the other
// sides of a box/carton). See docs/ADMIN.md.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id: productId } = await params;
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const url = body.url?.trim();
  if (!url) return NextResponse.json({ message: "Angiv en billed-URL" }, { status: 400 });

  const existingCount = await prisma.productImage.count({ where: { productId } });
  if (existingCount >= MAX_SECONDARY_IMAGES) {
    return NextResponse.json({ message: `Der må højst være ${MAX_SECONDARY_IMAGES} øvrige billeder` }, { status: 400 });
  }

  const image = await prisma.productImage.create({ data: { productId, url, order: existingCount } });
  return NextResponse.json({ image });
}

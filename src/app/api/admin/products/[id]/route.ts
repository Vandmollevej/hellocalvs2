import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// PATCH /api/admin/products/[id] — admin edits to name/brand/macros.
// Registrations store their own snapshot (titleSnapshot/kcalSnapshot/...),
// so this never retroactively changes what past users logged — see
// docs/DECISIONS.md's retroactive-edit note. Only future views/registrations
// of this product see the new values.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const brandName = typeof body.brand === "string" ? body.brand.trim() : undefined;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : undefined;
  const kcal = parseNumber(body.kcalPer100g);
  const protein = parseNumber(body.proteinPer100g);
  const carbs = parseNumber(body.carbsPer100g);
  const fat = parseNumber(body.fatPer100g);

  if (name !== undefined && !name) {
    return NextResponse.json({ message: "Navn må ikke være tomt" }, { status: 400 });
  }

  let brandId: string | null | undefined;
  if (brandName !== undefined) {
    brandId = brandName
      ? (await prisma.brand.upsert({ where: { name: brandName }, update: {}, create: { name: brandName } })).id
      : null;
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(brandId !== undefined ? { brandId } : {}),
      ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
      ...(kcal !== undefined ? { kcalPer100g: kcal } : {}),
      ...(protein !== undefined ? { proteinPer100g: protein } : {}),
      ...(carbs !== undefined ? { carbsPer100g: carbs } : {}),
      ...(fat !== undefined ? { fatPer100g: fat } : {}),
    },
    include: { brand: true, images: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ product });
}

function parseNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const num = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(num) && num >= 0 ? num : undefined;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { syncProductNutritionFeatures } from "@/lib/product-nutrition-features";

const MAX_BATCH = 500;

// POST /api/admin/products/nutrition-features — (re)computes
// ProductNutritionFeatures (sugar/fiber/salt per 100 g + %, whole grain) for
// existing products from the evidence already in the database
// (nutritionExtra, ingredientsText, AI analyses), docs/DECISIONS.md
// 2026-09-23. No OCR/AI calls. Paged: pass the returned `nextCursor` back as
// `cursor` until it is null. Also used after importer runs (REMA 1000,
// HelloFresh), which write products straight to the database.
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { cursor?: unknown; take?: unknown };
  const cursor = typeof body.cursor === "string" && body.cursor ? body.cursor : undefined;
  const take = typeof body.take === "number" && body.take > 0 ? Math.min(Math.floor(body.take), MAX_BATCH) : 200;

  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true },
  });

  let updated = 0;
  let failed = 0;
  for (const product of products) {
    try {
      if (await syncProductNutritionFeatures(product.id)) updated++;
    } catch (error) {
      failed++;
      console.error("ProductNutritionFeatures backfill failed", product.id, error);
    }
  }

  return NextResponse.json({
    processed: products.length,
    updated,
    failed,
    nextCursor: products.length === take ? products[products.length - 1].id : null,
  });
}

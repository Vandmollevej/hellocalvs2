import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Canonical JSONL export. Bevidst ikke hardcodet til én bestemt fine-tuning-
// model/format, så datasættet kan genbruges til evals, prompting og senere
// fine-tuning.
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const rows = await prisma.aiProductAnalysis.findMany({
    where: {
      correctedAt: { not: null },
      productId: { not: null },
    },
    include: {
      product: {
        include: { brand: true, images: { orderBy: { order: "asc" } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const jsonl = rows
    .filter((row) => row.product)
    .map((row) =>
      JSON.stringify({
        id: row.id,
        kind: row.kind,
        barcode: row.barcode,
        marketRegion: row.marketRegion,
        gs1Regions: row.gs1Regions,
        languages: row.languages,
        model: row.model,
        promptVersion: row.promptVersion,
        prediction: row.prediction,
        target: row.correction,
        confidence: row.confidence,
        imageUrl:
          row.kind === "FRONT"
            ? row.product?.imageUrl ?? null
            : row.kind === "INGREDIENTS"
              ? null
              : null,
        product: row.product
          ? {
              id: row.product.id,
              brand: row.product.brand?.name ?? null,
              subbrand: row.product.subbrand,
              name: row.product.name,
              variant: row.product.variant,
              packageSizeText: row.product.packageSizeText,
            }
          : null,
      }),
    )
    .join("\n");

  return new Response(jsonl + (jsonl ? "\n" : ""), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hello-cal-ai-training-feedback.jsonl"',
      "Cache-Control": "no-store",
    },
  });
}

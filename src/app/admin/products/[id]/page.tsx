import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ProductDetailEditor } from "@/components/admin/ProductDetailEditor";
import { QualityControlPanel } from "@/components/admin/QualityControlPanel";
import { NutritionReportPanel } from "@/components/admin/NutritionReportPanel";
import { ProductTablesPanel } from "@/components/admin/ProductTablesPanel";
import { parseNutritionReportChanges } from "@/lib/nutrition-reports";
import { hasQualityControlPhotoType, QUALITY_CONTROL_PHOTO_TYPES } from "@/lib/quality-control-photo-types";

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const [product, matchChecks, nutritionReports] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        images: { orderBy: { order: "asc" } },
        category: { select: { name: true, parent: { select: { name: true } } } },
        barcodes: { select: { code: true } },
        stores: { select: { store: { select: { name: true } } } },
        nutritionFeatures: true,
        filters: true,
      },
    }),
    // Kvalitetskontrol (docs/DECISIONS.md, 2026-09-19): "Problemer fundet"
    // vises kun for stadig-uafklarede issues — enten aldrig gennemgået, eller
    // gennemgået men med en Award der stadig afventer et nyt billede.
    prisma.productMatchCheck.findMany({
      where: {
        productId: id,
        photoType: { in: [...QUALITY_CONTROL_PHOTO_TYPES] },
        OR: [{ status: "PENDING" }, { award: { status: { in: ["OPEN", "SUBMITTED"] } } }],
      },
      include: { award: true, analysis: { select: { imageUrl: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.productNutritionReport.findMany({
      where: { productId: id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!product) notFound();
  // HelloFresh-retter kan ikke redigeres og hører ikke under Nye varer
  // (docs/DECISIONS.md 2026-10-07) — kun visning under Retter.
  if (product.externalSource === "HELLOFRESH") redirect(`/admin/dishes/hellofresh/${product.id}`);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">{product.name}</h1>
      <QualityControlPanel
        matchChecks={matchChecks.filter(hasQualityControlPhotoType).map((check) => ({
          ...check,
          imageUrl: check.analysis.imageUrl,
        }))}
      />
      <NutritionReportPanel
        reports={nutritionReports.map((report) => ({
          id: report.id,
          confidence: report.confidence,
          amountGrams: report.amountGrams,
          createdAt: report.createdAt.toISOString(),
          canReply: report.reporterUserId !== null,
          changes: parseNutritionReportChanges(report.changes),
        }))}
      />
      <ProductTablesPanel
        basics={{
          name: product.name,
          brand: product.brand?.name ?? null,
          subbrand: product.subbrand,
          productType: product.productType,
          variant: product.variant,
          flavor: product.flavor,
          packageSizeText: product.packageSizeText,
          packCount: product.packCount,
          productCategory: product.productCategory,
          category: product.category
            ? [product.category.parent?.name, product.category.name].filter(Boolean).join(" › ")
            : null,
          packaging: product.packaging,
          barcodes: product.barcodes.map((barcode) => barcode.code),
          stores: product.stores.map((entry) => entry.store.name),
          keywords: product.keywords,
          externalSource: product.externalSource,
          ingredientsText: product.ingredientsText,
          allergens: product.allergens,
          additives: product.additives,
        }}
        macros={product}
        nutrition={product.nutritionFeatures}
        filters={product.filters}
      />
      <ProductDetailEditor product={product} />
    </div>
  );
}

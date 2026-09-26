import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ProductDetailEditor } from "@/components/admin/ProductDetailEditor";
import { QualityControlPanel } from "@/components/admin/QualityControlPanel";
import { NutritionReportPanel } from "@/components/admin/NutritionReportPanel";
import { parseNutritionReportChanges } from "@/lib/nutrition-reports";
import { hasQualityControlPhotoType, QUALITY_CONTROL_PHOTO_TYPES } from "@/lib/quality-control-photo-types";

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const [product, matchChecks, nutritionReports] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { brand: true, images: { orderBy: { order: "asc" } } },
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
      <ProductDetailEditor product={product} />
    </div>
  );
}

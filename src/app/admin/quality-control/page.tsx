import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { t } from "@/lib/admin-i18n";
import { QualityControlTable, type QualityControlRow } from "@/components/admin/QualityControlTable";
import { hasQualityControlPhotoType, QUALITY_CONTROL_PHOTO_TYPES } from "@/lib/quality-control-photo-types";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Kvalitetskontrol (docs/DECISIONS.md, 2026-09-19): standardvisningen viser
// alle PENDING match-checks (klient-side filter kan udvide til 0-50/50-80/
// 80-100/alle), sorteret som udgangspunkt efter mest brugte produkt med
// lavest confidence først — se QualityControlTable.
export default async function AdminQualityControlPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const matchChecks = await prisma.productMatchCheck.findMany({
    where: { status: "PENDING", photoType: { in: [...QUALITY_CONTROL_PHOTO_TYPES] } },
    include: {
      product: { select: { id: true, name: true, brand: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Brugerindberettede næringsændringer (docs/DECISIONS.md 2026-09-23) vises
  // i samme liste, samlet til én række pr. produkt med antal indberetninger.
  const nutritionReports = await prisma.productNutritionReport.findMany({
    where: { status: "PENDING" },
    include: {
      product: { select: { id: true, name: true, brand: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const productIds = [
    ...new Set([...matchChecks.map((check) => check.productId), ...nutritionReports.map((r) => r.productId)]),
  ];
  const cutoff = daysAgo(30);
  // Anonym daglig brug (docs/PRIVACY.md) — brugernes registreringer ligger
  // krypteret i deres boks og kan ikke tælles her.
  const usageCounts = productIds.length
    ? await prisma.productUsageDaily.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, day: { gte: cutoff } },
        _sum: { count: true },
      })
    : [];
  const usageByProductId = new Map(usageCounts.map((row) => [row.productId, row._sum.count ?? 0]));

  const matchRows: QualityControlRow[] = matchChecks.filter(hasQualityControlPhotoType).map((check) => ({
    kind: "match",
    id: check.id,
    productId: check.productId,
    productName: check.product.name,
    brandName: check.product.brand?.name ?? null,
    photoType: check.photoType,
    confidence: check.confidence,
    createdAt: check.createdAt.toISOString(),
    usageLast30Days: usageByProductId.get(check.productId) ?? 0,
  }));

  const reportRowsByProduct = new Map<string, QualityControlRow & { kind: "userEdit" }>();
  for (const report of nutritionReports) {
    const existing = reportRowsByProduct.get(report.productId);
    if (existing) {
      existing.reportCount += 1;
      existing.confidence = Math.min(existing.confidence ?? 100, report.confidence);
      continue;
    }
    reportRowsByProduct.set(report.productId, {
      kind: "userEdit",
      id: `user-edit-${report.productId}`,
      productId: report.productId,
      productName: report.product.name,
      brandName: report.product.brand?.name ?? null,
      reportCount: 1,
      confidence: report.confidence,
      createdAt: report.createdAt.toISOString(),
      usageLast30Days: usageByProductId.get(report.productId) ?? 0,
    });
  }

  const rows = [...matchRows, ...reportRowsByProduct.values()];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">{t(admin.locale, "quality_control_title")}</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">{t(admin.locale, "quality_control_empty")}</p>
      ) : (
        <QualityControlTable rows={rows} locale={admin.locale} />
      )}
    </div>
  );
}

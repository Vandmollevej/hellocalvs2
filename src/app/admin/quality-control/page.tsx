import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { t } from "@/lib/admin-i18n";
import { QualityControlTable } from "@/components/admin/QualityControlTable";

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
    where: { status: "PENDING" },
    include: {
      product: { select: { id: true, name: true, brand: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const productIds = [...new Set(matchChecks.map((check) => check.productId))];
  const cutoff = daysAgo(30);
  const usageCounts = productIds.length
    ? await prisma.registration.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, createdAt: { gte: cutoff } },
        _count: { _all: true },
      })
    : [];
  const usageByProductId = new Map(usageCounts.map((row) => [row.productId, row._count._all]));

  const rows = matchChecks.map((check) => ({
    id: check.id,
    productId: check.productId,
    productName: check.product.name,
    brandName: check.product.brand?.name ?? null,
    photoType: check.photoType,
    confidence: check.confidence,
    createdAt: check.createdAt.toISOString(),
    usageLast30Days: usageByProductId.get(check.productId) ?? 0,
  }));

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

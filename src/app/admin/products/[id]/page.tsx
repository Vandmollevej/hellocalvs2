import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ProductDetailEditor } from "@/components/admin/ProductDetailEditor";
import { QualityControlPanel } from "@/components/admin/QualityControlPanel";

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const [product, matchChecks] = await Promise.all([
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
        OR: [{ status: "PENDING" }, { award: { status: { in: ["OPEN", "SUBMITTED"] } } }],
      },
      include: { award: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">{product.name}</h1>
      <QualityControlPanel matchChecks={matchChecks} />
      <ProductDetailEditor product={product} />
    </div>
  );
}

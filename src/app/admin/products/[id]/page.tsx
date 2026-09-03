import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ProductDetailEditor } from "@/components/admin/ProductDetailEditor";

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { brand: true, images: { orderBy: { order: "asc" } } },
  });
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">{product.name}</h1>
      <ProductDetailEditor product={product} />
    </div>
  );
}

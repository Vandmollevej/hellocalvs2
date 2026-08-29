import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { PendingProductCard } from "@/components/admin/PendingProductCard";

export default async function AdminProductsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const products = await prisma.product.findMany({
    where: { status: "PENDING" },
    include: { brand: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">Nye produkter</h1>
      <p className="text-sm text-text-secondary">Nyeste øverst.</p>
      {products.length === 0 ? (
        <p className="text-sm text-text-secondary">Ingen produkter afventer godkendelse.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((product) => (
            <PendingProductCard
              key={product.id}
              product={{ ...product, createdAt: product.createdAt.toISOString() }}
              hasExtra={Boolean(product.servingSizeGrams || product.ingredientsText || product.allergens.length)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

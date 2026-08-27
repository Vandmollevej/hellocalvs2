import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { PendingImageCard } from "@/components/admin/PendingImageCard";

export default async function AdminImagesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const products = await prisma.product.findMany({
    where: { imageStatus: "PENDING" },
    include: { brand: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">Billedforslag</h1>
      {products.length === 0 ? (
        <p className="text-sm text-text-secondary">Ingen billedforslag afventer godkendelse.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((product) => (
            <PendingImageCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

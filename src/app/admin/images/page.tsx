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
      <h1 className="hf-type-title text-hf-black">Billedforslag</h1>
      {products.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen billedforslag afventer godkendelse.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {products.map((product) => (
            <PendingImageCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

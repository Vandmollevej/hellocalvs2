import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { PendingImageBoard } from "@/components/admin/PendingImageBoard";
import { ImagesTabs } from "@/components/admin/ImagesTabs";

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
      <h1 className="hf-type-title text-hf-black">Billedbehandling</h1>
      <ImagesTabs active="suggestions" />
      <PendingImageBoard
        items={products.map((product) => ({
          id: product.id,
          title: product.name,
          subtitle: product.brand?.name ?? null,
          slides: [
            { src: product.imageUrl, label: "Nuværende" },
            { src: product.pendingImageUrl, label: "Forslag (Google)" },
          ],
        }))}
      />
    </div>
  );
}

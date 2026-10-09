import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { toUploadItem } from "@/lib/brand-logo-upload";
import { toProductImageItem } from "@/lib/product-image-upload";
import { BrandLogoUploader } from "@/components/admin/BrandLogoUploader";
import { BrandLogoUploadHistory } from "@/components/admin/BrandLogoUploadHistory";
import { ProductImageUploader } from "@/components/admin/ProductImageUploader";
import { ProductImageConflicts } from "@/components/admin/ProductImageConflicts";
import { ProductImageUploadHistory } from "@/components/admin/ProductImageUploadHistory";

// Admin "Varedatabase → Billeder": Billed-upload og Logo-upload lagt sammen i
// to kolonner (produktbilleder til venstre, brand-logoer til højre). Hver
// kolonne er uændret: drag and drop, partier med tidsstempel, historik.

const BATCH_LIMIT = 20;

export default async function AdminImagesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const canEdit = admin.adminAccessLevel === "FULL";

  const [conflicts, imageBatches, logoBatches] = await Promise.all([
    prisma.productImageUpload.findMany({ where: { status: "CONFLICT" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.productImageUploadBatch.findMany({
      where: { items: { some: {} } },
      orderBy: { createdAt: "desc" },
      take: BATCH_LIMIT,
      include: { items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    }),
    prisma.brandLogoUploadBatch.findMany({
      where: { items: { some: {} } },
      orderBy: { createdAt: "desc" },
      take: BATCH_LIMIT,
      include: {
        items: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: { brand: { select: { name: true, logoUrl: true } } },
        },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="hf-type-title text-hf-black">Billeder</h1>
        <p className="hf-type-body text-text-secondary">
          Billeder som lægges op på varer, generiske ingredienser og brands.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="hf-type-body hf-type-strong text-hf-black">Produktbilleder</h2>
          <ProductImageUploader canEdit={canEdit} />
          <ProductImageConflicts items={conflicts.map(toProductImageItem)} canEdit={canEdit} />
          <ProductImageUploadHistory
            canEdit={canEdit}
            batches={imageBatches.map((batch) => ({
              id: batch.id,
              createdAt: batch.createdAt.toISOString(),
              items: batch.items.map(toProductImageItem),
            }))}
          />
        </section>

        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="hf-type-body hf-type-strong text-hf-black">Logoer</h2>
          <BrandLogoUploader canEdit={canEdit} />
          <BrandLogoUploadHistory
            canEdit={canEdit}
            batches={logoBatches.map((batch) => ({
              id: batch.id,
              createdAt: batch.createdAt.toISOString(),
              items: batch.items.map(toUploadItem),
            }))}
          />
        </section>
      </div>
    </div>
  );
}

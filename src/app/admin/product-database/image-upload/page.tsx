import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { toProductImageItem } from "@/lib/product-image-upload";
import { ProductImageUploader } from "@/components/admin/ProductImageUploader";
import { ProductImageConflicts } from "@/components/admin/ProductImageConflicts";
import { ProductImageUploadHistory } from "@/components/admin/ProductImageUploadHistory";

// Admin "Varedatabase → Billed-upload" (docs/DECISIONS.md 2026-10-04): drag and
// drop af produktbilleder. Filnavnet er et EAN eller en produkttype, evt. med
// _raw / _pl til sidst. Findes varen allerede med et billede, lægges det nye
// ikke op, men står under «Findes allerede» (Ignorer / Erstat / Vis forskel).
// Hvert slip er et parti med tidsstempel, som kan slettes samlet.

const BATCH_LIMIT = 20;

export default async function AdminImageUploadPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const canEdit = admin.adminAccessLevel === "FULL";

  const [conflicts, batches] = await Promise.all([
    prisma.productImageUpload.findMany({ where: { status: "CONFLICT" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.productImageUploadBatch.findMany({
      where: { items: { some: {} } },
      orderBy: { createdAt: "desc" },
      take: BATCH_LIMIT,
      include: { items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="hf-type-title text-hf-black">Billed-upload</h1>
        <p className="hf-type-body text-text-secondary">
          Træk produktbilleder ind, og de sættes på varen, filnavnet svarer til. Logoer til brands lægges op under{" "}
          <Link href="/admin/product-database/logo-upload" className="text-hf-green-dark underline">
            Logo-upload
          </Link>
          .
        </p>
      </div>

      <ProductImageUploader canEdit={canEdit} />

      <ProductImageConflicts items={conflicts.map(toProductImageItem)} canEdit={canEdit} />

      <ProductImageUploadHistory
        canEdit={canEdit}
        batches={batches.map((batch) => ({
          id: batch.id,
          createdAt: batch.createdAt.toISOString(),
          items: batch.items.map(toProductImageItem),
        }))}
      />
    </div>
  );
}

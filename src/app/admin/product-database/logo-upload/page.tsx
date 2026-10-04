import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { toUploadItem } from "@/lib/brand-logo-upload";
import { BrandLogoUploader } from "@/components/admin/BrandLogoUploader";
import { BrandLogoUploadHistory } from "@/components/admin/BrandLogoUploadHistory";

// Admin "Varedatabase → Logo-upload" (docs/DECISIONS.md 2026-10-04): drag and
// drop af logoer. Filnavnet er brandets navn; hvert slip er et parti med
// tidsstempel, som kan slettes samlet. Oversigten viser størrelse,
// original-dimensioner, filstørrelse og processen for hver fil.

const BATCH_LIMIT = 20;

export default async function AdminLogoUploadPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const batches = await prisma.brandLogoUploadBatch.findMany({
    where: { items: { some: {} } },
    orderBy: { createdAt: "desc" },
    take: BATCH_LIMIT,
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { brand: { select: { name: true, logoUrl: true } } },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="hf-type-title text-hf-black">Logo-upload</h1>
        <p className="hf-type-body text-text-secondary">
          Træk logoer ind, og de sættes på det brand, filnavnet svarer til. Se alle brands og deres logoer under{" "}
          <Link href="/admin/product-database/brands" className="text-hf-green-dark underline">
            Brands
          </Link>
          .
        </p>
      </div>

      <BrandLogoUploader canEdit={admin.adminAccessLevel === "FULL"} />

      <BrandLogoUploadHistory
        canEdit={admin.adminAccessLevel === "FULL"}
        batches={batches.map((batch) => ({
          id: batch.id,
          createdAt: batch.createdAt.toISOString(),
          items: batch.items.map(toUploadItem),
        }))}
      />
    </div>
  );
}

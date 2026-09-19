import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { DuplicateProductCard } from "@/components/admin/DuplicateProductCard";

// /admin/duplicate-products — "Dobbeltoprettelser" (docs/ADMIN.md). Lists
// pairs of products flagged by src/lib/product-duplicates.ts because they
// were created with the same name within a short window of each other (two
// people, or the same offline-queued submission replaying twice — see
// src/lib/offline-product-queue.ts). Distinct from the older, broader
// same-name list on /admin/warnings: this page is specifically for
// reviewing and merging a genuine simultaneous double-creation, with real
// image-comparison and a Merge action, not just links to open each product.
export default async function AdminDuplicateProductsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const links = await prisma.productDuplicateLink.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      productA: { include: { brand: true, images: { orderBy: { order: "asc" } } } },
      productB: { include: { brand: true, images: { orderBy: { order: "asc" } } } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Dobbeltoprettelser</h1>
        <p className="text-sm text-text-secondary">
          Produkter der er oprettet med samme navn næsten samtidig. Sammenlign billedkvaliteten, vælg hvilke
          billeder der skal bruges, og flet parret til ét produkt.
        </p>
      </div>

      {links.length === 0 ? (
        <p className="text-sm text-text-secondary">Ingen dobbeltoprettelser afventer gennemgang.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {links.map((link) => (
            <DuplicateProductCard key={link.id} link={link} />
          ))}
        </div>
      )}
    </div>
  );
}

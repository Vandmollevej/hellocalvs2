import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { PendingProductCard } from "@/components/admin/PendingProductCard";
import { t } from "@/lib/admin-i18n";

// Adskilt visning af bruger-indsendte vs. auto-importerede (AI/API/DB)
// produkter (docs/DECISIONS.md 2026-09-02) — filter/faner, ikke en ny side.
// externalSource er null for bruger-indsendte produkter, sat for alt der
// kommer fra Open Food Facts/USDA/Frida/HelloFresh.
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "auto" ? "auto" : "user";

  const products = await prisma.product.findMany({
    where: {
      status: "PENDING",
      externalSource: tab === "auto" ? { not: null } : null,
    },
    include: { brand: true, images: true },
    orderBy: { createdAt: "desc" },
  });

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${active ? "bg-hf-green-dark text-hf-white" : "border border-border-strong text-text-secondary"}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">{t(admin.locale, "products_title")}</h1>
      <div className="flex gap-2">
        <Link href="/admin/products?tab=user" className={tabClass(tab === "user")}>
          {t(admin.locale, "products_tab_user")}
        </Link>
        <Link href="/admin/products?tab=auto" className={tabClass(tab === "auto")}>
          {t(admin.locale, "products_tab_auto")}
        </Link>
      </div>
      <p className="text-sm text-text-secondary">Nyeste øverst.</p>
      {products.length === 0 ? (
        <p className="text-sm text-text-secondary">Ingen produkter afventer godkendelse i denne fane.</p>
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

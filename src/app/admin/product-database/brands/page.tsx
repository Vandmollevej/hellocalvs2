import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { BrandGrid } from "@/components/admin/BrandGrid";
import { requireAdminUser, requireFullAdminUser } from "@/lib/require-admin";
import {
  ADMIN_BRANDS_PAGE_SIZE,
  adminBrandsHref,
  loadAdminBrands,
  parseAdminBrandsFilters,
  type AdminBrandsFilters,
  type AdminBrandsSearchParams,
} from "@/lib/admin-brands";
import { parseProductDatabaseFilters, productDatabaseHref } from "@/lib/admin-product-database-query";

// Admin "Produkt-database → Brands" (docs/DECISIONS.md 2026-09-28): alle
// brands med logo. Et klik viser brandets produkter under Produkter.

const numberFormat = new Intl.NumberFormat("da-DK");

function StatCard({ href, label, value, note }: { href: string; label: string; value: string; note: string }) {
  return (
    <Link href={href} className="hover:border-hf-green hf-panel">
      <p className="hf-type-body text-text-secondary">{label}</p>
      <p className="hf-type-hero mt-1 text-hf-green-dark">{value}</p>
      <p className="hf-type-small mt-auto pt-2 text-text-muted">{note}</p>
    </Link>
  );
}

function Pagination({ filters, page, pageCount }: { filters: AdminBrandsFilters; page: number; pageCount: number }) {
  return <AdminPagination page={page} pageCount={pageCount} hrefFor={(next) => adminBrandsHref(filters, { page: next })} />;
}

export default async function AdminBrandsPage({ searchParams }: { searchParams: Promise<AdminBrandsSearchParams> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const filters = parseAdminBrandsFilters(await searchParams);
  const data = await loadAdminBrands(filters);
  const clean = parseAdminBrandsFilters({});
  const productFilters = parseProductDatabaseFilters({});
  const canEdit = (await requireFullAdminUser()) !== null;
  const productHrefs = Object.fromEntries(data.rows.map((brand) => [brand.id, productDatabaseHref(productFilters, { brand: [brand.name] })]));
  const withoutLogo = data.total - data.withLogo;
  const logoPercent = data.total > 0 ? Math.round((data.withLogo / data.total) * 100) : 0;
  const firstIndex = data.matching === 0 ? 0 : (data.page - 1) * ADMIN_BRANDS_PAGE_SIZE + 1;
  const lastIndex = Math.min(firstIndex + data.rows.length - 1, data.matching);

  const logoOptions: { value: AdminBrandsFilters["logo"]; label: string }[] = [
    { value: "", label: "Alle" },
    { value: "with", label: "Med logo" },
    { value: "without", label: "Uden logo" },
  ];

  return (
    <div className="hf-admin-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="hf-type-title text-hf-black">Brands</h1>
          <p className="hf-type-body text-text-secondary">
            Alle brands i Hello Cal med logo. Klik på et brand for at se dets varer.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard href={adminBrandsHref(clean)} label="Brands i alt" value={numberFormat.format(data.total)} note="Vis alle" />
        <StatCard
          href={adminBrandsHref(clean, { logo: "with" })}
          label="Med logo"
          value={numberFormat.format(data.withLogo)}
          note={`${logoPercent} % af alle brands`}
        />
        <StatCard
          href={adminBrandsHref(clean, { logo: "without" })}
          label="Uden logo"
          value={numberFormat.format(withoutLogo)}
          note="Vis dem uden logo →"
        />
      </div>

      <form action="/admin/product-database/brands" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Søg efter brand"
          className="hf-input hf-input--compact w-full sm:max-w-sm"
        />
        {filters.logo && <input type="hidden" name="logo" value={filters.logo} />}
        <div className="hf-surface hf-type-small flex overflow-hidden">
          {logoOptions.map((option) => (
            <Link
              key={option.value || "all"}
              href={adminBrandsHref(filters, { logo: option.value })}
              className={`px-3 py-2 ${
                filters.logo === option.value ? "bg-hf-green-dark text-hf-white" : "bg-hf-white text-text-secondary hover:bg-hf-tan"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </form>

      <div className="flex flex-col gap-4">
        <p className="hf-type-body text-text-secondary">
          {data.matching === 0 ? (
            "Ingen brands matcher."
          ) : (
            <>
              Viser <span className="hf-type-strong text-hf-black">{numberFormat.format(firstIndex)}–{numberFormat.format(lastIndex)}</span> af{" "}
              <span className="hf-type-strong text-hf-black">{numberFormat.format(data.matching)}</span> brands
            </>
          )}
        </p>

        <BrandGrid rows={data.rows} productHrefs={productHrefs} canEdit={canEdit} />

        <Pagination filters={filters} page={data.page} pageCount={data.pageCount} />
      </div>
    </div>
  );
}

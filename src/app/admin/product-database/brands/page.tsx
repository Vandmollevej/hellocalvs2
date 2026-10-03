import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import {
  ADMIN_BRANDS_PAGE_SIZE,
  adminBrandsHref,
  loadAdminBrands,
  parseAdminBrandsFilters,
  type AdminBrandRow,
  type AdminBrandsFilters,
  type AdminBrandsSearchParams,
} from "@/lib/admin-brands";
import { parseProductDatabaseFilters, productDatabaseHref } from "@/lib/admin-product-database-query";

// Admin "Produkt-database → Brands" (docs/DECISIONS.md 2026-09-28): alle
// brands med logo. Et klik viser brandets produkter under Produkter.

const numberFormat = new Intl.NumberFormat("da-DK");

function StatCard({ href, label, value, note }: { href: string; label: string; value: string; note: string }) {
  return (
    <Link href={href} className="flex flex-col hf-surface p-4 hover:border-hf-green">
      <p className="hf-type-body text-text-secondary">{label}</p>
      <p className="hf-type-hero mt-1 text-hf-green-dark">{value}</p>
      <p className="hf-type-small mt-auto pt-2 text-text-muted">{note}</p>
    </Link>
  );
}

function BrandLogo({ brand }: { brand: AdminBrandRow }) {
  if (!brand.logoUrl) {
    return (
      <div
        className="hf-type-title flex aspect-[3/2] w-full items-center justify-center rounded-md bg-hf-tan uppercase text-text-muted"
        title="Intet logo"
      >
        {brand.name.charAt(0)}
      </div>
    );
  }
  return (
    <div className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-md bg-hf-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.logoUrl} alt={brand.name} loading="lazy" className="h-full w-full object-contain p-3" />
    </div>
  );
}

function Pagination({ filters, page, pageCount }: { filters: AdminBrandsFilters; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const linkClass = "hf-type-body rounded-md border border-hf-tan-dark bg-hf-white px-4 py-2 text-hf-black hover:border-hf-green";
  const disabledClass = "hf-type-body rounded-md border border-hf-tan-dark px-4 py-2 text-text-muted";
  return (
    <nav aria-label="Sider" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={adminBrandsHref(filters, { page: page - 1 })} className={linkClass}>
          ← Forrige
        </Link>
      ) : (
        <span className={disabledClass}>← Forrige</span>
      )}
      <span className="hf-type-body text-text-secondary">
        Side {numberFormat.format(page)} af {numberFormat.format(pageCount)}
      </span>
      {page < pageCount ? (
        <Link href={adminBrandsHref(filters, { page: page + 1 })} className={linkClass}>
          Næste →
        </Link>
      ) : (
        <span className={disabledClass}>Næste →</span>
      )}
    </nav>
  );
}

export default async function AdminBrandsPage({ searchParams }: { searchParams: Promise<AdminBrandsSearchParams> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const filters = parseAdminBrandsFilters(await searchParams);
  const data = await loadAdminBrands(filters);
  const clean = parseAdminBrandsFilters({});
  const productFilters = parseProductDatabaseFilters({});
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="hf-type-title text-hf-black">Brands</h1>
        <p className="hf-type-body text-text-secondary">
          Alle brands i Hello Cal med logo. Klik på et brand for at se dets varer.
        </p>
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
          className="hf-type-body h-10 w-full rounded-md border border-hf-tan-dark bg-hf-white px-3 text-hf-black outline-none placeholder:text-text-muted focus:border-hf-green sm:max-w-sm"
        />
        {filters.logo && <input type="hidden" name="logo" value={filters.logo} />}
        <div className="hf-type-small flex overflow-hidden rounded-md border border-hf-tan-dark">
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

        {data.rows.length > 0 && (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {data.rows.map((brand) => (
              <li key={brand.id}>
                <Link
                  href={productDatabaseHref(productFilters, { brand: [brand.name] })}
                  className="flex h-full flex-col gap-2 hf-surface p-2 hover:border-hf-green"
                >
                  <BrandLogo brand={brand} />
                  <div className="flex min-w-0 flex-col gap-0.5 px-1 pb-1">
                    <p className="hf-type-body hf-type-strong truncate text-hf-black">{brand.name}</p>
                    <p className="hf-type-small text-text-muted">
                      {numberFormat.format(brand.productCount)} vare{brand.productCount === 1 ? "" : "er"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Pagination filters={filters} page={data.page} pageCount={data.pageCount} />
      </div>
    </div>
  );
}

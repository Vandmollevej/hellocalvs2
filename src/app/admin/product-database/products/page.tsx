import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadProductDatabase, loadProductDatabaseSuggestions, type ProductDatabaseRow } from "@/lib/admin-product-database";
import {
  PRODUCT_DATABASE_PAGE_SIZE,
  PRODUCT_STATUS_LABELS,
  parseProductDatabaseFilters,
  productDatabaseHref,
  type ProductDatabaseFilters as Filters,
  type ProductDatabaseSearchParams,
} from "@/lib/admin-product-database-query";
import { ProductDatabaseFilters } from "@/components/admin/ProductDatabaseFilters";

// Admin "Produkt-database → Produkter" (docs/DECISIONS.md 2026-09-27,
// 2026-09-28: flyttet fra /admin/product-database): alle produkter
// med søgning, filtre og sortering. Et klik åbner produktets egen
// admin-side (/admin/products/[id]).

const numberFormat = new Intl.NumberFormat("da-DK");

function StatCard({ href, label, value, note }: { href: string; label: string; value: string; note: string }) {
  return (
    <Link href={href} className="flex flex-col rounded-lg border border-hf-tan-dark bg-hf-white p-4 hover:border-hf-green">
      <p className="hf-type-body text-text-secondary">{label}</p>
      <p className="hf-type-hero mt-1 text-hf-green-dark">{value}</p>
      <p className="hf-type-small mt-auto pt-2 text-text-muted">{note}</p>
    </Link>
  );
}

function StatusBadge({ status }: { status: ProductDatabaseRow["status"] }) {
  const tone =
    status === "APPROVED"
      ? "bg-hf-green-light text-hf-green-dark"
      : status === "PENDING"
        ? "bg-hf-warning-bg text-hf-warning"
        : "border border-hf-red-dark text-hf-red-dark";
  return (
    <span className={`hf-type-micro hf-type-strong shrink-0 rounded-full px-2 py-0.5 ${tone}`}>
      {PRODUCT_STATUS_LABELS[status]}
    </span>
  );
}

function NoImageIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="m21 16-5-5-8 9M3 3l18 18" />
    </svg>
  );
}

function Thumbnail({ row, size }: { row: ProductDatabaseRow; size: "row" | "card" }) {
  const box = size === "row" ? "h-12 w-12 rounded-md" : "aspect-square w-full rounded-md";
  if (!row.imageUrl) {
    return (
      <div className={`${box} flex shrink-0 items-center justify-center bg-hf-tan text-text-muted`} title="Intet billede">
        <NoImageIcon className={size === "row" ? "h-5 w-5" : "h-10 w-10"} />
      </div>
    );
  }
  return (
    <div className={`${box} shrink-0 overflow-hidden bg-hf-white ${size === "row" ? "border border-hf-tan-dark" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={row.imageUrl} alt="" loading="lazy" className={`h-full w-full object-contain ${size === "card" ? "p-3" : "p-0.5"}`} />
    </div>
  );
}

function subtitle(row: ProductDatabaseRow) {
  return [row.subbrand, row.variant, row.packageSizeText].filter(Boolean).join(" · ");
}

function StoreTags({ stores }: { stores: string[] }) {
  if (stores.length === 0) return <span className="hf-type-small text-text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {stores.map((store) => (
        <span key={store} className="hf-type-micro hf-type-strong rounded-full bg-hf-tan px-2 py-0.5 text-hf-black">
          {store}
        </span>
      ))}
    </span>
  );
}

function ListView({ rows }: { rows: ProductDatabaseRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-hf-tan-dark bg-hf-white">
      <div className="hf-type-small hidden grid-cols-[48px_minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_88px_96px] gap-4 border-b border-hf-tan-dark px-4 py-2 text-text-secondary lg:grid">
        <span />
        <span>Produkt</span>
        <span>Kæder</span>
        <span>Kategori · kilde</span>
        <span className="text-right">Kcal/100</span>
        <span className="text-right">Status</span>
      </div>
      <ul className="divide-y divide-border-strong">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/admin/products/${row.id}`}
              className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 hover:bg-hf-tan lg:grid-cols-[48px_minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_88px_96px]"
            >
              <Thumbnail row={row} size="row" />
              <div className="min-w-0">
                <p className="hf-type-body truncate text-hf-black">
                  {row.brandName && <span className="hf-type-strong">{row.brandName} </span>}
                  {row.name}
                </p>
                <p className="hf-type-small truncate text-text-muted">
                  {subtitle(row) || (row.barcodeCount > 0 ? `${row.barcodeCount} stregkode${row.barcodeCount > 1 ? "r" : ""}` : "Ingen stregkode")}
                </p>
                <div className="mt-1 lg:hidden">
                  <StoreTags stores={row.stores} />
                </div>
              </div>
              <div className="hidden min-w-0 lg:block">
                <StoreTags stores={row.stores} />
              </div>
              <div className="hidden min-w-0 lg:block">
                <p className="hf-type-small truncate text-hf-black">{row.categoryLabel ?? "Uden kategori"}</p>
                <p className="hf-type-small truncate text-text-muted">{row.sourceLabel}</p>
              </div>
              <p className="hf-type-small hidden text-right text-text-secondary lg:block">{Math.round(row.kcalPer100g)}</p>
              <div className="flex justify-end">
                <StatusBadge status={row.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GridView({ rows }: { rows: ProductDatabaseRow[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/admin/products/${row.id}`}
            className="flex h-full flex-col gap-2 rounded-lg border border-hf-tan-dark bg-hf-white p-2 hover:border-hf-green"
          >
            <div className="relative">
              <Thumbnail row={row} size="card" />
              <span className="absolute left-2 top-2">
                <StatusBadge status={row.status} />
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-1 pb-1">
              {row.brandName && <p className="hf-type-small hf-type-strong truncate text-text-secondary">{row.brandName}</p>}
              <p className="hf-type-body line-clamp-2 text-hf-black">{row.name}</p>
              {subtitle(row) && <p className="hf-type-small truncate text-text-muted">{subtitle(row)}</p>}
              <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                <StoreTags stores={row.stores} />
                <span className="hf-type-micro shrink-0 text-text-muted">{Math.round(row.kcalPer100g)} kcal</span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Pagination({ filters, pageCount }: { filters: Filters; pageCount: number }) {
  if (pageCount <= 1) return null;
  const page = Math.min(filters.page, pageCount);
  const linkClass = "hf-type-body rounded-md border border-hf-tan-dark bg-hf-white px-4 py-2 text-hf-black hover:border-hf-green";
  const disabledClass = "hf-type-body rounded-md border border-hf-tan-dark px-4 py-2 text-text-muted";
  return (
    <nav aria-label="Sider" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={productDatabaseHref(filters, { page: page - 1 })} className={linkClass}>
          ← Forrige
        </Link>
      ) : (
        <span className={disabledClass}>← Forrige</span>
      )}
      <span className="hf-type-body text-text-secondary">
        Side {numberFormat.format(page)} af {numberFormat.format(pageCount)}
      </span>
      {page < pageCount ? (
        <Link href={productDatabaseHref(filters, { page: page + 1 })} className={linkClass}>
          Næste →
        </Link>
      ) : (
        <span className={disabledClass}>Næste →</span>
      )}
    </nav>
  );
}

export default async function AdminProductDatabasePage({
  searchParams,
}: {
  searchParams: Promise<ProductDatabaseSearchParams>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const filters = parseProductDatabaseFilters(await searchParams);
  const [data, suggestions] = await Promise.all([
    loadProductDatabase(filters),
    loadProductDatabaseSuggestions(filters.brand),
  ]);
  const { overview } = data;
  const withoutImage = overview.total - overview.withImage;
  const imagePercent = overview.total > 0 ? Math.round((overview.withImage / overview.total) * 100) : 0;
  const firstIndex = data.matching === 0 ? 0 : (filters.page - 1) * PRODUCT_DATABASE_PAGE_SIZE + 1;
  const lastIndex = Math.min(filters.page * PRODUCT_DATABASE_PAGE_SIZE, data.matching);
  const clean: Filters = parseProductDatabaseFilters({});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="hf-type-title text-hf-black">Produkter</h1>
        <p className="hf-type-body text-text-secondary">
          Alle produkter i Hello Cal. Søg, filtrér og sortér — klik på et produkt for at åbne dets produktside.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard href={productDatabaseHref(clean)} label="Produkter i alt" value={numberFormat.format(overview.total)} note="Vis alle" />
        <StatCard
          href={productDatabaseHref(clean, { image: "with" })}
          label="Med billede"
          value={numberFormat.format(overview.withImage)}
          note={`${imagePercent} % af databasen`}
        />
        <StatCard
          href={productDatabaseHref(clean, { image: "without" })}
          label="Uden billede"
          value={numberFormat.format(withoutImage)}
          note="Vis dem uden billede →"
        />
        <StatCard
          href={productDatabaseHref(clean, { status: "PENDING" })}
          label="Afventer godkendelse"
          value={numberFormat.format(overview.pending)}
          note={`${numberFormat.format(overview.approved)} godkendt`}
        />
      </div>

      <ProductDatabaseFilters
        filters={filters}
        stores={data.stores}
        categories={data.categories}
        brands={suggestions.brands}
        subbrands={suggestions.subbrands}
      />

      <div className="flex flex-col gap-4">
        <p className="hf-type-body text-text-secondary">
          {data.matching === 0 ? (
            "Ingen produkter matcher."
          ) : (
            <>
              Viser <span className="hf-type-strong text-hf-black">{numberFormat.format(firstIndex)}–{numberFormat.format(lastIndex)}</span> af{" "}
              <span className="hf-type-strong text-hf-black">{numberFormat.format(data.matching)}</span> produkter
            </>
          )}
        </p>

        {data.rows.length === 0 ? (
          <div className="rounded-lg border border-hf-tan-dark bg-hf-white px-4 py-12 text-center">
            <p className="hf-type-body text-text-secondary">Prøv en anden søgning eller fjern et filter.</p>
            <Link href={productDatabaseHref(clean, { view: filters.view })} className="hf-btn-text mt-2 text-hf-green-dark">
              Nulstil alle filtre
            </Link>
          </div>
        ) : filters.view === "grid" ? (
          <GridView rows={data.rows} />
        ) : (
          <ListView rows={data.rows} />
        )}

        <Pagination filters={filters} pageCount={data.pageCount} />
      </div>
    </div>
  );
}

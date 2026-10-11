import Link from "next/link";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadProductDatabase, loadProductDatabaseSuggestions, type ProductDatabaseRow } from "@/lib/admin-product-database";
import {
  PRODUCT_COLUMNS,
  PRODUCT_COLUMN_LABELS,
  parseProductDatabaseFilters,
  productDatabaseHref,
  type ProductColumn,
  type ProductDatabaseFilters as Filters,
  type ProductDatabaseSearchParams,
} from "@/lib/admin-product-database-query";
import { problemText, rowProblems } from "@/lib/admin-list-problems";
import { InfiniteScrollLoader } from "@/components/admin/InfiniteScrollLoader";
import { ProductDatabaseFilters } from "@/components/admin/ProductDatabaseFilters";
import { SavedViewsControls } from "@/components/admin/SavedViewsControls";
import { BulkActionsBar, BulkRow, BulkSelection } from "@/components/admin/BulkSelection";
import { StatusToggle } from "@/components/admin/StatusToggle";

// Admin "Produkt-database → Produkter" (docs/DECISIONS.md 2026-09-27,
// 2026-09-28: flyttet fra /admin/product-database): alle produkter
// med søgning, filtre og sortering. Et klik åbner produktets egen
// admin-side (/admin/products/[id]). Rækker kan markeres (klik, Ctrl/⌘,
// Shift) og behandles samlet under "Handlinger"; en vare uden billede eller
// næring har rød kant; status er tekst + on/off-knap; slettede varer ligger
// under "Slettede" (docs/DECISIONS.md 2026-10-11).

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
      <div className={`${box} flex shrink-0 items-center justify-center border border-hf-red-dark bg-hf-tan text-hf-red-dark`} title="Intet billede">
        <NoImageIcon className={size === "row" ? "h-5 w-5" : "h-10 w-10"} />
      </div>
    );
  }
  return (
    <div className={`${box} shrink-0 overflow-hidden bg-hf-white ${size === "row" ? "border border-hf-tan-dark" : ""} ${row.disabled ? "opacity-50" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={row.imageUrl} alt="" loading="lazy" className={`h-full w-full object-contain ${size === "card" ? "p-3" : "p-0.5"}`} />
    </div>
  );
}

function additionsText(row: ProductDatabaseRow) {
  return row.additions === null ? "—" : numberFormat.format(row.additions);
}

function subtitle(row: ProductDatabaseRow) {
  return [row.subbrand, row.variant, row.packageSizeText].filter(Boolean).join(" · ");
}

// Mangler og deaktivering som rød tekst under navnet; slettede rækker er
// allerede i "Slettede" og flages ikke.
function flags(row: ProductDatabaseRow) {
  if (row.deleted) return { problems: [], text: "" };
  const problems = rowProblems({ imageUrl: row.imageUrl, nutritionMissing: row.nutritionMissing });
  const parts = [row.disabled ? "Deaktiveret — vises ikke for brugerne" : null, problems.length > 0 ? problemText(problems) : null];
  return { problems, text: parts.filter(Boolean).join(" · ") };
}

function nameClass(row: ProductDatabaseRow, extra = "") {
  return `hf-type-body ${extra} ${row.disabled || row.deleted ? "text-text-muted line-through" : "text-hf-black"}`;
}

function RowStatus({ row }: { row: ProductDatabaseRow }) {
  return <StatusToggle kind="product" id={row.id} status={row.status} disabled={row.disabled} deleted={row.deleted} />;
}

function StoreTags({ stores }: { stores: string[] }) {
  if (stores.length === 0) return <span className="hf-type-small text-text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {stores.map((store) => (
        <span key={store} className="hf-badge">
          {store}
        </span>
      ))}
    </span>
  );
}

function BrandHeader({ filters }: { filters: Filters }) {
  const next = filters.sort === "brand" ? "brand_desc" : "brand";
  const arrow = filters.sort === "brand" ? " ↑" : filters.sort === "brand_desc" ? " ↓" : "";
  return (
    <Link href={productDatabaseHref(filters, { sort: next })} className="hover:text-hf-green-dark" title="Sortér efter mærke">
      Mærke{arrow}
    </Link>
  );
}

// Kolonnebredder i listen, pr. valgbart felt (rækkefølgen følger PRODUCT_COLUMNS).
const LIST_COLUMN_WIDTH: Record<ProductColumn, string> = {
  brand: "minmax(0,1fr)",
  stores: "minmax(0,1.1fr)",
  category: "minmax(0,1fr)",
  kcal: "88px",
  additions: "96px",
  status: "190px",
};

function ListView({ rows, columns, filters }: { rows: ProductDatabaseRow[]; columns: ProductColumn[]; filters: Filters }) {
  const shown = PRODUCT_COLUMNS.filter((key) => columns.includes(key));
  const has = (key: ProductColumn) => shown.includes(key);
  const template = ["48px", "minmax(0,2.2fr)", ...shown.map((key) => LIST_COLUMN_WIDTH[key])].join(" ");
  const mobileCols = has("status") ? "grid-cols-[48px_minmax(0,1fr)_auto]" : "grid-cols-[48px_minmax(0,1fr)]";
  const rowStyle = { "--list-cols": template } as React.CSSProperties;
  return (
    <div className="overflow-hidden hf-surface">
      <div style={rowStyle} className="hf-type-small hidden gap-4 border-b border-hf-tan-dark px-4 py-2 text-text-secondary lg:grid lg:[grid-template-columns:var(--list-cols)]">
        <span />
        <span>Vare</span>
        {shown.map((key) => (
          <span key={key} className={key === "kcal" || key === "additions" || key === "status" ? "text-right" : undefined}>
            {key === "brand" ? <BrandHeader filters={filters} /> : PRODUCT_COLUMN_LABELS[key]}
          </span>
        ))}
      </div>
      <ul className="divide-y divide-border-strong">
        {rows.map((row) => {
          const flag = flags(row);
          return (
            <BulkRow
              key={row.id}
              id={row.id}
              problem={flag.problems.length > 0}
              style={rowStyle}
              className={`grid ${mobileCols} items-center gap-4 px-4 py-3 hover:bg-hf-tan lg:[grid-template-columns:var(--list-cols)]`}
            >
              <Link href={`/admin/products/${row.id}`} className="contents">
                <Thumbnail row={row} size="row" />
                <div className="min-w-0">
                  <p className={nameClass(row, "truncate")}>{row.name}</p>
                  <p className="hf-type-small truncate text-text-muted">
                    {row.brandName && <span className="lg:hidden">{row.brandName} · </span>}
                    {subtitle(row) || (row.barcodeCount > 0 ? `${row.barcodeCount} stregkode${row.barcodeCount > 1 ? "r" : ""}` : "Ingen stregkode")}
                  </p>
                  {flag.text && <p className="hf-type-small truncate text-hf-red-dark">{flag.text}</p>}
                  {has("stores") && (
                    <div className="mt-1 lg:hidden">
                      <StoreTags stores={row.stores} />
                    </div>
                  )}
                </div>
                {shown.map((key) => {
                  switch (key) {
                    case "brand":
                      return (
                        <p key={key} className="hf-type-small hidden truncate text-hf-black lg:block">
                          {row.brandName ?? "—"}
                        </p>
                      );
                    case "stores":
                      return (
                        <div key={key} className="hidden min-w-0 lg:block">
                          <StoreTags stores={row.stores} />
                        </div>
                      );
                    case "category":
                      return (
                        <div key={key} className="hidden min-w-0 lg:block">
                          <p className="hf-type-small truncate text-hf-black">{row.categoryLabel ?? "Uden kategori"}</p>
                          <p className="hf-type-small truncate text-text-muted">{row.sourceLabel}</p>
                        </div>
                      );
                    case "kcal":
                      return (
                        <p key={key} className={`hf-type-small hidden text-right lg:block ${row.nutritionMissing ? "text-hf-red-dark" : "text-text-secondary"}`}>
                          {row.nutritionMissing ? "Mangler næring" : Math.round(row.kcalPer100g)}
                        </p>
                      );
                    case "additions":
                      return (
                        <p key={key} className="hf-type-small hidden text-right text-text-secondary lg:block">
                          {additionsText(row)}
                        </p>
                      );
                    case "status":
                      return null;
                  }
                })}
              </Link>
              {has("status") && (
                <div className="flex justify-end">
                  <RowStatus row={row} />
                </div>
              )}
            </BulkRow>
          );
        })}
      </ul>
    </div>
  );
}

// Detaljer: kun tekst, uden billeder — flere felter pr. vare end i listen.
function DetailsView({ rows, filters }: { rows: ProductDatabaseRow[]; filters: Filters }) {
  const cols = "lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_72px_72px_96px_190px]";
  return (
    <div className="overflow-hidden hf-surface">
      <div className={`hf-type-small hidden gap-4 border-b border-hf-tan-dark px-4 py-2 text-text-secondary lg:grid ${cols}`}>
        <span>Vare</span>
        <BrandHeader filters={filters} />
        <span>Kæder</span>
        <span>Kategori</span>
        <span>Kilde</span>
        <span className="text-right">Kcal/100</span>
        <span className="text-right">Stregkoder</span>
        <span className="text-right">Tilføjelser</span>
        <span className="text-right">Status</span>
      </div>
      <ul className="divide-y divide-border-strong">
        {rows.map((row) => {
          const flag = flags(row);
          return (
            <BulkRow
              key={row.id}
              id={row.id}
              problem={flag.problems.length > 0}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2 hover:bg-hf-tan ${cols}`}
            >
              <Link href={`/admin/products/${row.id}`} className="contents">
                <div className="min-w-0">
                  <p className={nameClass(row, "truncate")}>{row.name}</p>
                  {(row.brandName || subtitle(row)) && (
                    <p className="hf-type-small truncate text-text-muted">
                      {row.brandName && <span className="lg:hidden">{row.brandName}{subtitle(row) && " · "}</span>}
                      {subtitle(row)}
                    </p>
                  )}
                  {flag.text && <p className="hf-type-small truncate text-hf-red-dark">{flag.text}</p>}
                </div>
                <p className="hf-type-small hidden truncate text-hf-black lg:block">{row.brandName ?? "—"}</p>
                <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 lg:col-span-1 lg:block">
                  <StoreTags stores={row.stores} />
                </div>
                <p className="hf-type-small truncate text-hf-black">{row.categoryLabel ?? "Uden kategori"}</p>
                <p className="hf-type-small truncate text-text-muted">{row.sourceLabel}</p>
                <p className={`hf-type-small text-right ${row.nutritionMissing ? "text-hf-red-dark" : "text-text-secondary"}`}>
                  {row.nutritionMissing ? "Mangler" : `${Math.round(row.kcalPer100g)} kcal`}
                </p>
                <p className="hf-type-small text-right text-text-secondary">{row.barcodeCount}</p>
                <p className="hf-type-small text-right text-text-secondary">{additionsText(row)}</p>
              </Link>
              <div className="col-start-2 row-start-1 flex justify-end lg:col-auto lg:row-auto">
                <RowStatus row={row} />
              </div>
            </BulkRow>
          );
        })}
      </ul>
    </div>
  );
}

function GridView({ rows, columns }: { rows: ProductDatabaseRow[]; columns: ProductColumn[] }) {
  const has = (key: ProductColumn) => columns.includes(key);
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {rows.map((row) => {
        const flag = flags(row);
        return (
          <BulkRow
            key={row.id}
            id={row.id}
            problem={flag.problems.length > 0}
            className="flex h-full flex-col gap-2 rounded-lg hf-surface p-2 hover:border-hf-green"
          >
            <Link href={`/admin/products/${row.id}`} className="flex flex-1 flex-col gap-2">
              <Thumbnail row={row} size="card" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-1 pb-1">
                {row.brandName && <p className="hf-type-small hf-type-strong truncate text-text-secondary">{row.brandName}</p>}
                <p className={nameClass(row, "line-clamp-2")}>{row.name}</p>
                {subtitle(row) && <p className="hf-type-small truncate text-text-muted">{subtitle(row)}</p>}
                {flag.text && <p className="hf-type-small text-hf-red-dark">{flag.text}</p>}
                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  {has("stores") ? <StoreTags stores={row.stores} /> : <span />}
                  <span className="hf-type-micro shrink-0 text-text-muted">
                    {has("additions") && row.additions !== null && `${additionsText(row)} tilføjelser`}
                    {has("additions") && row.additions !== null && has("kcal") && " · "}
                    {has("kcal") && (row.nutritionMissing ? "Mangler næring" : `${Math.round(row.kcalPer100g)} kcal`)}
                  </span>
                </div>
              </div>
            </Link>
            {has("status") && (
              <div className="flex justify-end px-1 pb-1">
                <RowStatus row={row} />
              </div>
            )}
          </BulkRow>
        );
      })}
    </ul>
  );
}

function Pagination({ filters, pageCount }: { filters: Filters; pageCount: number }) {
  const page = Math.min(filters.page, pageCount);
  return <AdminPagination page={page} pageCount={pageCount} hrefFor={(next) => productDatabaseHref(filters, { page: next })} />;
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
  const infinite = filters.paging === "infinite";
  const deletedView = filters.deleted === "1";
  const firstIndex = data.matching === 0 ? 0 : infinite ? 1 : (filters.page - 1) * filters.perPage + 1;
  const lastIndex = Math.min(filters.page * filters.perPage, data.matching);
  const clean: Filters = parseProductDatabaseFilters({});
  const missingImage = overview.total - overview.withImage;
  const tabClass = (active: boolean) =>
    `hf-type-body rounded-md px-3 py-1.5 ${active ? "bg-hf-green-dark text-hf-white" : "text-hf-black hover:bg-hf-tan"}`;

  return (
    <div className="hf-admin-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="hf-type-title text-hf-black">{deletedView ? "Slettede varer" : "Varer"}</h1>
          <p className="hf-type-body text-text-secondary">
            {deletedView
              ? "Varer, der er slettet. Markér og vælg Gendan under Handlinger for at få dem tilbage i gennemsyn."
              : "Alle varer i Hello Cal. Søg, filtrér og sortér — klik på en vare for at åbne dens vareside."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-md border border-hf-tan-dark bg-hf-white p-1" role="group" aria-label="Aktive eller slettede">
            <Link href={productDatabaseHref(filters, { deleted: "" })} aria-current={!deletedView ? "page" : undefined} className={tabClass(!deletedView)}>
              Aktive
            </Link>
            <Link href={productDatabaseHref(filters, { deleted: "1" })} aria-current={deletedView ? "page" : undefined} className={tabClass(deletedView)}>
              Slettede ({numberFormat.format(overview.deleted)})
            </Link>
          </div>
          <Link
            href="/admin/product-database/images"
            className="hf-type-body hf-control inline-flex items-center rounded-md bg-hf-green-dark px-4 text-hf-white"
          >
            Upload billeder
          </Link>
        </div>
      </div>

      {!deletedView && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            href={productDatabaseHref(clean)}
            label="Total"
            value={numberFormat.format(overview.segments.total.products)}
            note={`${numberFormat.format(overview.segments.total.additions)} tilføjelser`}
          />
          <StatCard
            href={productDatabaseHref(clean, { barcode: "with" })}
            label="EAN"
            value={numberFormat.format(overview.segments.ean.products)}
            note={`${numberFormat.format(overview.segments.ean.additions)} tilføjelser`}
          />
          <StatCard
            href={productDatabaseHref(clean, { barcode: "without" })}
            label="Generisk"
            value={numberFormat.format(overview.segments.generic.products)}
            note={`${numberFormat.format(overview.segments.generic.additions)} tilføjelser`}
          />
        </div>
      )}

      <ProductDatabaseFilters
        filters={filters}
        stores={data.stores}
        categories={data.categories}
        brands={suggestions.brands}
        subbrands={suggestions.subbrands}
      />

      <BulkSelection kind="product" ids={data.rows.map((row) => row.id)} deletedView={deletedView}>
        <div className="flex flex-col gap-4">
          {!deletedView && (missingImage > 0 || overview.missingNutrition > 0) && (
            <p className="hf-type-body hf-type-strong text-hf-red-dark" role="status">
              {missingImage > 0 && (
                <Link href={productDatabaseHref(filters, { image: "without" })} className="underline">
                  {numberFormat.format(missingImage)} varer mangler billede
                </Link>
              )}
              {missingImage > 0 && overview.missingNutrition > 0 && " · "}
              {overview.missingNutrition > 0 && (
                <Link href={productDatabaseHref(filters, { nutrition: "missing" })} className="underline">
                  {numberFormat.format(overview.missingNutrition)} varer mangler næring
                </Link>
              )}
            </p>
          )}

          <BulkActionsBar />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="hf-type-body text-text-secondary">
              {data.matching === 0 ? (
                "Ingen varer matcher."
              ) : (
                <>
                  Viser <span className="hf-type-strong text-hf-black">{numberFormat.format(firstIndex)}–{numberFormat.format(lastIndex)}</span> af{" "}
                  <span className="hf-type-strong text-hf-black">{numberFormat.format(data.matching)}</span> varer
                </>
              )}
            </p>
            <SavedViewsControls filters={filters} />
          </div>

          {data.rows.length === 0 ? (
            <div className="hf-surface px-4 py-12 text-center">
              <p className="hf-type-body text-text-secondary">
                {deletedView ? "Ingen slettede varer." : "Prøv en anden søgning eller fjern et filter."}
              </p>
              <Link href={productDatabaseHref(clean, { view: filters.view })} className="hf-btn-text mt-2 text-hf-green-dark">
                Nulstil alle filtre
              </Link>
            </div>
          ) : filters.view === "grid" ? (
            <GridView rows={data.rows} columns={filters.cols} />
          ) : filters.view === "details" ? (
            <DetailsView rows={data.rows} filters={filters} />
          ) : (
            <ListView rows={data.rows} columns={filters.cols} filters={filters} />
          )}

          {infinite ? (
            lastIndex < data.matching && <InfiniteScrollLoader filters={filters} />
          ) : (
            <Pagination filters={filters} pageCount={data.pageCount} />
          )}
        </div>
      </BulkSelection>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { OffToolsPanel } from "@/components/admin/OffToolsPanel";
import { requireAdminUser, requireFullAdminUser } from "@/lib/require-admin";
import {
  ADMIN_OFF_PAGE_SIZE,
  OFF_BAND_HIGH,
  OFF_BAND_MID,
  OFF_ISSUE_LABELS,
  adminOffHref,
  confidenceClass,
  loadAdminOff,
  parseAdminOffFilters,
  type AdminOffFilters,
  type AdminOffSearchParams,
} from "@/lib/admin-off";

// Admin "Varedatabase → Open Food Facts" (docs/DECISIONS.md 2026-10-11): varer hentet fra
// Open Food Facts, lagt i vores egen tabel med navnet opdelt efter vores navneregler
// (mærke, sub brand, produkttype, variation, nøgleord, mængde) og en sikkerhed i %.

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

function ChoiceRow<T extends string>({
  options,
  current,
  hrefFor,
}: {
  options: { value: T; label: string }[];
  current: T;
  hrefFor: (value: T) => string;
}) {
  return (
    <div className="hf-surface hf-type-small flex flex-wrap overflow-hidden">
      {options.map((option) => (
        <Link
          key={option.value || "all"}
          href={hrefFor(option.value)}
          className={`px-3 py-2 ${current === option.value ? "bg-hf-green-dark text-hf-white" : "bg-hf-white text-text-secondary hover:bg-hf-tan"}`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function Pagination({ filters, page, pageCount }: { filters: AdminOffFilters; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const linkClass = "hf-type-body rounded-md border border-hf-tan-dark bg-hf-white px-4 py-2 text-hf-black hover:border-hf-green";
  const disabledClass = "hf-type-body rounded-md border border-hf-tan-dark px-4 py-2 text-text-muted";
  return (
    <nav aria-label="Sider" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={adminOffHref(filters, { page: page - 1 })} className={linkClass}>
          ← Forrige
        </Link>
      ) : (
        <span className={disabledClass}>← Forrige</span>
      )}
      <span className="hf-type-body text-text-secondary">
        Side {numberFormat.format(page)} af {numberFormat.format(pageCount)}
      </span>
      {page < pageCount ? (
        <Link href={adminOffHref(filters, { page: page + 1 })} className={linkClass}>
          Næste →
        </Link>
      ) : (
        <span className={disabledClass}>Næste →</span>
      )}
    </nav>
  );
}

export default async function AdminOffPage({ searchParams }: { searchParams: Promise<AdminOffSearchParams> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const filters = parseAdminOffFilters(await searchParams);
  const data = await loadAdminOff(filters);
  const clean = parseAdminOffFilters({});
  const canEdit = (await requireFullAdminUser()) !== null;
  const firstIndex = data.matching === 0 ? 0 : (data.page - 1) * ADMIN_OFF_PAGE_SIZE + 1;
  const lastIndex = Math.min(firstIndex + data.rows.length - 1, data.matching);

  return (
    <div className="hf-admin-page">
      <div className="flex flex-col gap-1">
        <h1 className="hf-type-title text-hf-black">Open Food Facts</h1>
        <p className="hf-type-body text-text-secondary">
          Varer hentet fra Open Food Facts og gemt lokalt. Navnet er delt op efter vores navneregler, og sikkerheden
          viser, hvor sandsynligt det er, at opdelingen er korrekt (målt mod vores egne rettede ark).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard href={adminOffHref(clean)} label="Varer fra OFF" value={numberFormat.format(data.total)} note="Vis alle" />
        <StatCard
          href={adminOffHref(clean, { band: "high" })}
          label={`Sikre (${OFF_BAND_HIGH} % og over)`}
          value={numberFormat.format(data.stats.high)}
          note={`Gennemsnit ${data.stats.avg} %`}
        />
        <StatCard
          href={adminOffHref(clean, { band: "mid" })}
          label={`Middel (${OFF_BAND_MID}–${OFF_BAND_HIGH - 1} %)`}
          value={numberFormat.format(data.stats.mid)}
          note="Gennemse"
        />
        <StatCard
          href={adminOffHref(clean, { band: "low" })}
          label={`Usikre (under ${OFF_BAND_MID} %)`}
          value={numberFormat.format(data.stats.low)}
          note={`${numberFormat.format(data.stats.foreign)} med ikke-dansk navn`}
        />
      </div>

      <OffToolsPanel canEdit={canEdit} />

      <form action="/admin/product-database/open-food-facts" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Søg på stregkode, navn, mærke eller type"
          className="hf-input hf-input--compact w-full sm:max-w-sm"
        />
        {filters.band && <input type="hidden" name="band" value={filters.band} />}
        {filters.link && <input type="hidden" name="link" value={filters.link} />}
        {filters.lang && <input type="hidden" name="lang" value={filters.lang} />}
        {filters.issue && <input type="hidden" name="issue" value={filters.issue} />}
        {filters.sort !== "confidence" && <input type="hidden" name="sort" value={filters.sort} />}
        <button type="submit" className="hf-btn-secondary hf-btn--compact">
          Søg
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <ChoiceRow
          current={filters.band}
          hrefFor={(value) => adminOffHref(filters, { band: value })}
          options={[
            { value: "", label: "Alle" },
            { value: "high", label: "Sikre" },
            { value: "mid", label: "Middel" },
            { value: "low", label: "Usikre" },
          ]}
        />
        <ChoiceRow
          current={filters.link}
          hrefFor={(value) => adminOffHref(filters, { link: value })}
          options={[
            { value: "", label: "Alle" },
            { value: "linked", label: "Findes som vare" },
            { value: "unlinked", label: "Kun i OFF-tabellen" },
          ]}
        />
        <ChoiceRow
          current={filters.sort}
          hrefFor={(value) => adminOffHref(filters, { sort: value })}
          options={[
            { value: "confidence", label: "Usikreste først" },
            { value: "recent", label: "Nyeste" },
            { value: "name", label: "Navn" },
          ]}
        />
      </div>

      {data.issues.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="hf-type-small text-text-muted">Årsager:</span>
          {data.issues.map((item) => (
            <Link
              key={item.issue}
              href={adminOffHref(filters, { issue: filters.issue === item.issue ? "" : item.issue })}
              className={`hf-type-small rounded-md border px-2 py-1 ${
                filters.issue === item.issue
                  ? "border-hf-green-dark bg-hf-green-dark text-hf-white"
                  : "border-hf-tan-dark bg-hf-white text-text-secondary hover:bg-hf-tan"
              }`}
            >
              {OFF_ISSUE_LABELS[item.issue] ?? item.issue} ({numberFormat.format(item.count)})
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
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

        {data.rows.length > 0 && (
          <div className="hf-surface hf-table-scroll">
            <table className="hf-type-body w-full text-left">
              <thead>
                <tr className="hf-table-section hf-type-small">
                  <th className="px-3 py-2">Sikkerhed</th>
                  <th className="px-3 py-2">OFF-navn</th>
                  <th className="px-3 py-2">Mærke</th>
                  <th className="px-3 py-2">Sub brand</th>
                  <th className="px-3 py-2">Produkttype</th>
                  <th className="px-3 py-2">Variation</th>
                  <th className="px-3 py-2">Nøgleord</th>
                  <th className="px-3 py-2">Mængde</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.barcode} className="border-b border-hf-tan-dark align-top">
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/product-database/open-food-facts/${row.barcode}`}
                        className={`hf-type-strong ${confidenceClass(row.splitConfidence)}`}
                      >
                        {row.splitConfidence} %
                      </Link>
                      {row.splitIssues.length > 0 && (
                        <p className="hf-type-small text-text-muted" title={row.splitIssues.map((i) => OFF_ISSUE_LABELS[i] ?? i).join(", ")}>
                          {row.splitIssues.length} {row.splitIssues.length === 1 ? "årsag" : "årsager"}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-3">
                        {row.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.imageUrl} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md object-contain" />
                        )}
                        <div className="min-w-0">
                          <p className="hf-type-strong text-hf-black">{row.rawName ?? "—"}</p>
                          <p className="hf-type-small text-text-muted">
                            {row.barcode}
                            {row.rawBrands ? ` · ${row.rawBrands}` : ""}
                            {row.rawQuantity ? ` · ${row.rawQuantity}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{row.brand ?? "—"}</td>
                    <td className="px-3 py-3">{row.subbrand ?? "—"}</td>
                    <td className="px-3 py-3">{row.productType ?? "—"}</td>
                    <td className="px-3 py-3">{row.variant ?? "—"}</td>
                    <td className="px-3 py-3">{row.keywords.length ? row.keywords.join(", ") : "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{row.packageSizeText ?? "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="hf-type-caption">
                        {row.productId ? "Findes som vare" : "Kun i OFF-tabellen"}
                      </p>
                      {row.reviewedAt && <p className="hf-type-small text-hf-green-dark">Gennemgået</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination filters={filters} page={data.page} pageCount={data.pageCount} />
      </div>
    </div>
  );
}

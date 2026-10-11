import Link from "next/link";
import { IconSearch } from "@tabler/icons-react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { dishProblems, type DishPage, type DishRow } from "@/lib/admin-dishes";
import { LIST_PROBLEM_LABELS, problemText, type ListProblem } from "@/lib/admin-list-problems";
import type { BulkKind } from "@/lib/admin-bulk-actions";
import { BulkActionsBar, BulkRow, BulkSelection } from "@/components/admin/BulkSelection";
import { StatusToggle } from "@/components/admin/StatusToggle";

// Fælles liste for admin → Retter (docs/DECISIONS.md 2026-09-28): søgning,
// liste med billede, kcal og status, og sider à 48. Siden 2026-10-11: rækker
// kan markeres (klik, Ctrl/⌘, Shift) og behandles under "Handlinger"; en ret
// uden billede/næring har rød kant og står i den røde linje øverst; status er
// tekst + on/off-knap; slettede retter ligger under "Slettede".

const numberFormat = new Intl.NumberFormat("da-DK");

function NoImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="m21 16-5-5-8 9M3 3l18 18" />
    </svg>
  );
}

function Row({ row, kind }: { row: DishRow; kind: BulkKind }) {
  const problems = dishProblems(row);
  const redLine = [row.disabled && !row.deleted ? "Deaktiveret — vises ikke for brugerne" : null, problems.length > 0 ? problemText(problems) : null]
    .filter(Boolean)
    .join(" · ");
  const dim = row.disabled || row.deleted;
  // Billede + navn er linket til retten; til/fra-knappen ligger uden for linket.
  const main = (
    <>
      {row.imageUrl ? (
        <div className="hf-surface h-12 w-12 shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.imageUrl} alt="" loading="lazy" className={`h-full w-full object-cover ${dim ? "opacity-50" : ""}`} />
        </div>
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-hf-red-dark bg-hf-tan text-hf-red-dark" title="Intet billede">
          <NoImageIcon />
        </div>
      )}
      <div className="min-w-0">
        <p className={`hf-type-body truncate ${dim ? "text-text-muted line-through" : "text-hf-black"}`}>{row.name}</p>
        {row.note && <p className="hf-type-small truncate text-text-muted">{row.note}</p>}
        {redLine && <p className="hf-type-small truncate text-hf-red-dark">{redLine}</p>}
      </div>
    </>
  );
  const mainClass = "grid min-w-0 grid-cols-[48px_minmax(0,1fr)] items-center gap-4";
  return (
    <BulkRow
      id={row.id}
      problem={problems.length > 0}
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_130px_210px] ${row.href ? "hover:bg-hf-tan" : ""}`}
    >
      {row.href ? (
        <Link href={row.href} className={mainClass}>
          {main}
        </Link>
      ) : (
        <div className={mainClass}>{main}</div>
      )}
      <p className={`hf-type-small hidden text-right sm:block ${row.nutritionMissing ? "text-hf-red-dark" : "text-text-secondary"}`}>
        {row.nutritionMissing ? "Mangler næring" : `${numberFormat.format(Math.round(row.kcal))} ${row.kcalLabel}`}
      </p>
      <div className="flex items-center justify-end">
        <StatusToggle kind={kind} id={row.id} status={row.status} disabled={row.disabled && kind === "product"} deleted={row.deleted} />
      </div>
    </BulkRow>
  );
}

export function DishListPage({
  title,
  intro,
  basePath,
  q,
  data,
  empty,
  deleted = false,
  problem = "",
  canDisable = false,
}: {
  title: string;
  intro: string;
  basePath: string;
  q: string;
  data: DishPage;
  empty: string;
  // "Slettede"-visningen i stedet for de aktive retter.
  deleted?: boolean;
  // Kun retter med denne mangel (røde linje øverst).
  problem?: ListProblem | "";
  // Importerede retter er Product-rækker (kind "product"); brugerretter er
  // delte opskrifter (kind "recipe").
  canDisable?: boolean;
}) {
  const kind: BulkKind = canDisable ? "product" : "recipe";
  const hrefFor = (changes: { page?: number; deleted?: boolean; problem?: ListProblem | "" }) => {
    const next = { page: 1, deleted, problem, ...changes };
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (next.deleted) params.set("deleted", "1");
    if (next.problem) params.set("problem", next.problem);
    if (next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  const tabClass = (active: boolean) => `hf-choice ${active ? "is-selected" : ""}`;
  const { overview } = data;
  const problemCounts: { key: ListProblem; count: number; label: string }[] = [
    { key: "image", count: overview.missingImage, label: "mangler billede" },
    { key: "nutrition", count: overview.missingNutrition, label: "mangler næring" },
    { key: "ingredients", count: overview.missingIngredients, label: "mangler ingredienser" },
  ];
  const shownProblems = problemCounts.filter((entry) => entry.count > 0);

  return (
    <div className="hf-admin-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="hf-type-title text-hf-black">{deleted ? `${title} — slettede` : title}</h1>
          <p className="hf-type-body text-text-secondary">
            {deleted ? "Slettede retter. Markér og vælg Gendan under Handlinger for at få dem tilbage i gennemsyn." : intro}
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Aktive eller slettede">
          <Link href={hrefFor({ deleted: false, problem: "" })} aria-current={!deleted ? "page" : undefined} className={tabClass(!deleted)}>
            Aktive
          </Link>
          <Link href={hrefFor({ deleted: true, problem: "" })} aria-current={deleted ? "page" : undefined} className={tabClass(deleted)}>
            Slettede ({numberFormat.format(overview.deleted)})
          </Link>
        </div>
      </div>

      {/* Fælles søgefelt (.hf-search, design.md §6.5); Enter sender søgningen. */}
      <form action={basePath} role="search" className="hf-search">
        {deleted && <input type="hidden" name="deleted" value="1" />}
        {problem && !deleted && <input type="hidden" name="problem" value={problem} />}
        <IconSearch size={16} color="var(--hf-black)" aria-hidden />
        <input type="search" name="q" defaultValue={q} placeholder="Søg efter ret" aria-label="Søg efter ret" className="min-w-0" />
      </form>

      {!deleted && shownProblems.length > 0 && (
        <p className="hf-type-body hf-type-strong text-hf-red-dark" role="status">
          {shownProblems.map((entry, index) => (
            <span key={entry.key}>
              {index > 0 && " · "}
              <Link href={hrefFor({ problem: entry.key })} className={problem === entry.key ? "underline decoration-2" : "underline"}>
                {numberFormat.format(entry.count)} retter {entry.label}
              </Link>
            </span>
          ))}
        </p>
      )}

      <BulkSelection kind={kind} ids={data.rows.map((row) => row.id)} deletedView={deleted}>
        <div className="flex flex-col gap-4">
          <BulkActionsBar />

          <p className="hf-type-body text-text-secondary">
            <span className="hf-type-strong text-hf-black">{numberFormat.format(data.total)}</span> retter
            {problem && !deleted && (
              <>
                {" "}
                · kun «{LIST_PROBLEM_LABELS[problem].toLowerCase()}» ·{" "}
                <Link href={hrefFor({ problem: "" })} className="hf-btn-text text-hf-green-dark">
                  Vis alle
                </Link>
              </>
            )}
          </p>

          {data.rows.length === 0 ? (
            <div className="hf-surface px-4 py-12 text-center">
              <p className="hf-type-body text-text-secondary">{deleted ? "Ingen slettede retter." : empty}</p>
            </div>
          ) : (
            <ul className="hf-surface divide-y divide-border-strong overflow-hidden">
              {data.rows.map((row) => (
                <Row key={row.id} row={row} kind={kind} />
              ))}
            </ul>
          )}
        </div>
      </BulkSelection>

      <AdminPagination page={data.page} pageCount={data.pageCount} hrefFor={(next) => hrefFor({ page: next })} />
    </div>
  );
}

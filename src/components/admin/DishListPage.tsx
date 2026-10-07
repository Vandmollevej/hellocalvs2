import Link from "next/link";
import type { DishPage, DishRow } from "@/lib/admin-dishes";

// Fælles liste for admin → Retter (docs/DECISIONS.md 2026-09-28): søgning,
// liste med billede, kcal og status, og sider à 48.

const numberFormat = new Intl.NumberFormat("da-DK");
const STATUS_LABELS: Record<DishRow["status"], string> = {
  APPROVED: "Godkendt",
  PENDING: "Afventer",
  REJECTED: "Afvist",
};

function StatusBadge({ status }: { status: DishRow["status"] }) {
  const tone =
    status === "APPROVED"
      ? "bg-hf-green-light text-hf-green-dark"
      : status === "PENDING"
        ? "bg-hf-warning-bg text-hf-warning"
        : "border border-hf-red-dark text-hf-red-dark";
  return <span className={`hf-type-micro hf-type-strong shrink-0 rounded-full px-2 py-0.5 ${tone}`}>{STATUS_LABELS[status]}</span>;
}

type DisableAction = (form: FormData) => Promise<void>;

// "Deaktivér"/"Aktivér" på linjen (docs/DECISIONS.md 2026-10-07) — det eneste,
// admin kan ændre på en importeret ret.
function DisableButton({ row, action, path }: { row: DishRow; action: DisableAction; path: string }) {
  return (
    <form action={action} className="shrink-0 pr-4">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="disable" value={row.disabled ? "0" : "1"} />
      <button
        type="submit"
        className={`hf-type-small rounded-md border px-3 py-1.5 ${
          row.disabled
            ? "border-hf-green-dark text-hf-green-dark hover:bg-hf-green-light"
            : "border-hf-red-dark text-hf-red-dark hover:bg-hf-tan"
        }`}
      >
        {row.disabled ? "Aktivér" : "Deaktivér"}
      </button>
    </form>
  );
}

function Row({ row, disableAction, path }: { row: DishRow; disableAction?: DisableAction; path: string }) {
  const body = (
    <>
      <div className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border border-hf-tan-dark bg-hf-white ${row.disabled ? "opacity-40" : ""}`}>
        {row.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <p className={`hf-type-body truncate ${row.disabled ? "text-text-muted line-through" : "text-hf-black"}`}>{row.name}</p>
        {(row.disabled || row.note) && (
          <p className="hf-type-small truncate text-text-muted">
            {[row.disabled ? "Deaktiveret — vises ikke for brugerne" : null, row.note].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <p className="hf-type-small hidden text-right text-text-secondary sm:block">
        {numberFormat.format(Math.round(row.kcal))} {row.kcalLabel}
      </p>
      <div className="flex justify-end">
        <StatusBadge status={row.status} />
      </div>
    </>
  );
  const className = "grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[48px_minmax(0,1fr)_140px_96px]";
  const content = row.href ? (
    <Link href={row.href} className={`${className} hover:bg-hf-tan`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
  if (!disableAction) return <li>{content}</li>;
  return (
    <li className="flex items-center">
      <div className="min-w-0 flex-1">{content}</div>
      <DisableButton row={row} action={disableAction} path={path} />
    </li>
  );
}

export function DishListPage({
  title,
  intro,
  basePath,
  q,
  data,
  empty,
  disableAction,
}: {
  title: string;
  intro: string;
  basePath: string;
  q: string;
  data: DishPage;
  empty: string;
  // Kun importerede retter (HelloFresh/Valdemarsro) får knappen på linjen.
  disableAction?: DisableAction;
}) {
  const href = (page: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  const linkClass = "hf-type-body rounded-md border border-hf-tan-dark bg-hf-white px-4 py-2 text-hf-black hover:border-hf-green";
  const disabledClass = "hf-type-body rounded-md border border-hf-tan-dark px-4 py-2 text-text-muted";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="hf-type-title text-hf-black">{title}</h1>
        <p className="hf-type-body text-text-secondary">{intro}</p>
      </div>

      <form action={basePath} className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Søg efter ret"
          className="hf-type-body h-12 min-w-0 flex-1 rounded-md border border-hf-tan-dark bg-hf-white px-4 text-hf-black"
        />
        <button type="submit" className="hf-btn-text h-12 rounded-md bg-hf-green-dark px-5 text-hf-white">
          Søg
        </button>
      </form>

      <p className="hf-type-body text-text-secondary">
        <span className="hf-type-strong text-hf-black">{numberFormat.format(data.total)}</span> retter
      </p>

      {data.rows.length === 0 ? (
        <div className="hf-surface px-4 py-12 text-center">
          <p className="hf-type-body text-text-secondary">{empty}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border-strong overflow-hidden hf-surface">
          {data.rows.map((row) => (
            <Row key={row.id} row={row} disableAction={disableAction} path={basePath} />
          ))}
        </ul>
      )}

      {data.pageCount > 1 && (
        <nav aria-label="Sider" className="flex items-center justify-between gap-3">
          {data.page > 1 ? (
            <Link href={href(data.page - 1)} className={linkClass}>
              ← Forrige
            </Link>
          ) : (
            <span className={disabledClass}>← Forrige</span>
          )}
          <span className="hf-type-body text-text-secondary">
            Side {numberFormat.format(data.page)} af {numberFormat.format(data.pageCount)}
          </span>
          {data.page < data.pageCount ? (
            <Link href={href(data.page + 1)} className={linkClass}>
              Næste →
            </Link>
          ) : (
            <span className={disabledClass}>Næste →</span>
          )}
        </nav>
      )}
    </div>
  );
}

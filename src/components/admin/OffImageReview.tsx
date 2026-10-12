"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  OFF_IMAGE_MIN_INTERACTIONS,
  OFF_IMAGE_PER_PAGE,
  OFF_IMAGE_SORT_LABEL,
  OFF_IMAGE_TABS,
  OFF_IMAGE_TAB_LABEL,
  defaultSortFor,
  type OffImageDecision,
  type OffImageItem,
  type OffImageQuery,
  type OffImageSort,
  type OffImageTab,
} from "@/lib/off-image-review-shared";

// Admin "Open Food Facts → Billeder" (docs/DECISIONS.md 2026-10-11).
// Billeder i et gitter med skydeknap for størrelsen (1 = ét billede i højden
// ad gangen, scrollhjulet skifter billede). Venstre halvdel af billedet
// afviser, højre halvdel godkender; to knapper under hvert billede gør det
// samme. En afgørelse gemmes med det samme; et tryk på samme side igen
// fortryder den (billedet lægges tilbage under "Til gennemgang").

type Mark = OffImageDecision | null;

const COLS_KEY = "hc-off-images-cols";
const MIN_COLS = 1;
const MAX_COLS = 8;
const DEFAULT_COLS = 4;
// Plads til sidetal-bjælken under gitteret.
const BOTTOM_BAR = 76;

const SORTS_BY_TAB: Record<OffImageTab, OffImageSort[]> = {
  review: ["interactions_desc", "interactions_asc", "added_desc", "added_asc"],
  approved: ["changed_desc", "changed_asc", "interactions_desc", "interactions_asc", "added_desc", "added_asc"],
  rejected: ["changed_desc", "changed_asc", "interactions_desc", "interactions_asc", "added_desc", "added_asc"],
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pageNumbers(current: number, last: number): (number | "gap")[] {
  const wanted = new Set<number>([1, last, current - 2, current - 1, current, current + 1, current + 2]);
  const sorted = [...wanted].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, index) => {
    if (index > 0 && n - sorted[index - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

type CardProps = {
  item: OffImageItem;
  mark: Mark;
  single: boolean;
  compact: boolean;
  height: number | null;
  canEdit: boolean;
  onDecide: (id: string, decision: OffImageDecision) => void;
};

function Card({ item, mark, single, compact, height, canEdit, onDecide }: CardProps) {
  const ring =
    mark === "APPROVED"
      ? "border-hf-green-dark ring-2 ring-hf-green-dark"
      : mark === "REJECTED"
        ? "border-hf-red-dark ring-2 ring-hf-red-dark"
        : "border-hf-tan-dark";
  const breakdown = `Scanninger ${item.scans} · registreringer ${item.registrations} · favoritter ${item.favorites} · videresendt ${item.forwards}`;
  return (
    <article
      className={`flex min-w-0 flex-col overflow-hidden rounded-card border bg-hf-white ${ring}`}
      style={single ? { height: height ?? undefined, scrollSnapAlign: "start", scrollSnapStop: "always" } : undefined}
    >
      <div className={`relative bg-hf-white ${single ? "min-h-0 flex-1" : "aspect-square"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={item.name} loading="lazy" draggable={false} className="h-full w-full select-none object-contain p-2" />
        {mark && (
          <span
            className={`hf-type-caption absolute left-2 top-2 rounded-full px-2 py-0.5 text-hf-white ${
              mark === "APPROVED" ? "bg-hf-green-dark" : "bg-hf-red-dark"
            }`}
          >
            {mark === "APPROVED" ? "Godkendt" : "Afvist"}
          </span>
        )}
        {canEdit && (
          <>
            <button
              type="button"
              aria-label={`Afvis billedet af ${item.name}`}
              title={mark === "REJECTED" ? "Afvist — tryk igen for at fortryde" : "Afvis billedet"}
              onClick={() => onDecide(item.id, "REJECTED")}
              className="hf-btn-text group absolute inset-y-0 left-0 w-1/2"
            >
              <span className="hf-badge hf-badge--danger">
                Afvis
              </span>
            </button>
            <button
              type="button"
              aria-label={`Godkend billedet af ${item.name}`}
              title={mark === "APPROVED" ? "Godkendt — tryk igen for at fortryde" : "Godkend billedet"}
              onClick={() => onDecide(item.id, "APPROVED")}
              className="hf-btn-text group absolute inset-y-0 right-0 w-1/2"
            >
              <span className="hf-badge hf-badge--success">
                Godkend
              </span>
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col gap-0.5 border-t border-hf-tan-dark px-2 py-1.5">
        <p className={`hf-type-small text-hf-black ${compact ? "truncate" : "line-clamp-2"}`} title={item.name}>
          {item.brand ? `${item.brand} · ` : ""}
          {item.name}
        </p>
        <p className="hf-type-caption text-text-secondary" title={breakdown}>
          {item.interactions} {item.interactions === 1 ? "interaktion" : "interaktioner"}
          {!compact && item.barcode ? ` · ${item.barcode}` : ""}
        </p>
        {!compact && (
          <p className="hf-type-caption text-text-muted">
            I databasen {formatDate(item.addedAt)}
            {item.reviewedAt ? ` · ændret ${formatDate(item.reviewedAt)}` : ""}
          </p>
        )}
        {mark === "REJECTED" && (
          <p className="hf-type-caption text-hf-red-dark">
            {item.scanStatus === "done" ? "Scannet af en agent" : "Sendt til scan-appen — skal scannes"}
          </p>
        )}
      </div>

      {canEdit && (
        <div className="grid grid-cols-2 gap-1.5 p-1.5 pt-0">
          <button
            type="button"
            onClick={() => onDecide(item.id, "REJECTED")}
            aria-pressed={mark === "REJECTED"}
            className="hf-choice"
          >
            Afvist
          </button>
          <button
            type="button"
            onClick={() => onDecide(item.id, "APPROVED")}
            aria-pressed={mark === "APPROVED"}
            className="hf-choice"
          >
            Godkendt
          </button>
        </div>
      )}
    </article>
  );
}

export function OffImageReview({
  items,
  total,
  counts,
  query,
  canEdit,
}: {
  items: OffImageItem[];
  total: number;
  counts: Record<OffImageTab, number>;
  query: OffImageQuery;
  canEdit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [marks, setMarks] = useState<Record<string, Mark>>(() => Object.fromEntries(items.map((item) => [item.id, item.review])));
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [error, setError] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areaHeight, setAreaHeight] = useState<number | null>(null);
  const [search, setSearch] = useState(query.q);
  const areaRef = useRef<HTMLDivElement>(null);

  // Gemt størrelse (kun en bekvemmelighed pr. browser).
  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(COLS_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Number.isInteger(stored) && stored >= MIN_COLS && stored <= MAX_COLS) setCols(stored);
    } catch {
      // ingen lokal lagring — standardstørrelsen bruges
    }
  }, []);

  const changeCols = useCallback((value: number) => {
    setCols(value);
    try {
      window.localStorage.setItem(COLS_KEY, String(value));
    } catch {
      // ignorér
    }
  }, []);

  // Gitteret fylder resten af skærmen, så sidetallene altid står nederst.
  useLayoutEffect(() => {
    function measure() {
      const el = areaRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setAreaHeight(Math.max(320, Math.floor(window.innerHeight - top - BOTTOM_BAR)));
    }
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver !== "undefined" && areaRef.current?.parentElement ? new ResizeObserver(measure) : null;
    if (observer && areaRef.current?.parentElement) observer.observe(areaRef.current.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  const hrefFor = useCallback(
    (patch: Partial<Record<"tab" | "sort" | "perPage" | "offset" | "min" | "q", string | number | null>>) => {
      const next: Record<string, string> = {
        tab: query.tab,
        sort: query.sort,
        perPage: String(query.perPage),
        min: String(query.minInteractions),
        q: query.q,
      };
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "" || value === undefined) delete next[key];
        else next[key] = String(value);
      }
      // Ny fane/sortering/filter starter forfra.
      if (!("offset" in patch)) delete next.offset;
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        if (value === "" || (key === "min" && value === "0")) continue;
        params.set(key, value);
      }
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, query],
  );

  // Varer afgjort på denne side forsvinder fra "Til gennemgang": næste side
  // skal derfor starte lige efter dem, ellers springes en hel side over.
  const decidedHere = useMemo(
    () => (query.tab === "review" ? items.filter((item) => marks[item.id]).length : 0),
    [items, marks, query.tab],
  );

  const send = useCallback(
    async (ids: string[], decision: OffImageDecision | "RESET") => {
      const response = await fetch("/api/admin/off-images/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, decision }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Afgørelsen kunne ikke gemmes");
      }
    },
    [],
  );

  const decide = useCallback(
    (id: string, decision: OffImageDecision) => {
      const previous = marks[id] ?? null;
      const resetting = previous === decision;
      setMarks((current) => ({ ...current, [id]: resetting ? null : decision }));
      setError(null);
      send([id], resetting ? "RESET" : decision).catch((err: unknown) => {
        setMarks((current) => ({ ...current, [id]: previous }));
        setError(err instanceof Error ? err.message : "Afgørelsen kunne ikke gemmes");
      });
    },
    [marks, send],
  );

  const markAll = useCallback(async () => {
    // Kun billeder uden afgørelse: allerede afviste røres aldrig af "Marker alle".
    const targets = items.filter((item) => !marks[item.id]).map((item) => item.id);
    setConfirmAll(false);
    if (!targets.length) return;
    setSaving(true);
    setError(null);
    try {
      await send(targets, "APPROVED");
      setMarks((current) => ({ ...current, ...Object.fromEntries(targets.map((id) => [id, "APPROVED" as const])) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Afgørelserne kunne ikke gemmes");
    } finally {
      setSaving(false);
    }
  }, [items, marks, send]);

  const lastPage = Math.max(1, Math.ceil(total / query.perPage));
  const currentPage = Math.min(lastPage, Math.floor(query.offset / query.perPage) + 1);
  const goToPage = (page: number) => {
    const clamped = Math.min(lastPage, Math.max(1, page));
    const forwardShift = clamped > currentPage ? decidedHere : 0;
    router.push(hrefFor({ offset: Math.max(0, (clamped - 1) * query.perPage - forwardShift) }));
  };

  const single = cols === 1;
  const compact = cols >= 6;
  const from = items.length ? query.offset + 1 : 0;
  const to = query.offset + items.length;
  const sortOptions = SORTS_BY_TAB[query.tab];
  const unmarked = items.filter((item) => !marks[item.id]).length;
  const canMarkAll = canEdit && query.tab === "review" && items.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Faner" className="flex flex-wrap gap-1.5">
          {OFF_IMAGE_TABS.map((tab) => (
            <Link
              key={tab}
              href={hrefFor({ tab, sort: defaultSortFor(tab), offset: null })}
              aria-current={query.tab === tab ? "page" : undefined}
              className={`hf-type-small flex h-9 items-center gap-2 rounded-card border px-3 ${
                query.tab === tab ? "border-hf-black bg-hf-black text-hf-white" : "border-hf-tan-dark bg-hf-white text-hf-black"
              }`}
            >
              {OFF_IMAGE_TAB_LABEL[tab]}
              <span className={query.tab === tab ? "text-hf-white/80" : "text-text-muted"}>{counts[tab].toLocaleString("da-DK")}</span>
            </Link>
          ))}
        </nav>

        <label className="hf-type-caption flex items-center gap-1.5">
          Sortér
          <select
            value={query.sort}
            onChange={(event) => router.push(hrefFor({ sort: event.target.value }))}
            className="hf-input hf-input--compact"
          >
            {sortOptions.map((sort) => (
              <option key={sort} value={sort}>
                {OFF_IMAGE_SORT_LABEL[sort]}
              </option>
            ))}
          </select>
        </label>

        <label className="hf-type-caption flex items-center gap-1.5">
          Pr. side
          <select
            value={query.perPage}
            onChange={(event) => router.push(hrefFor({ perPage: event.target.value }))}
            className="hf-input hf-input--compact"
          >
            {OFF_IMAGE_PER_PAGE.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="hf-type-caption flex items-center gap-1.5">
          Interaktioner
          <select
            value={query.minInteractions}
            onChange={(event) => router.push(hrefFor({ min: event.target.value }))}
            className="hf-input hf-input--compact"
          >
            {OFF_IMAGE_MIN_INTERACTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Alle" : `Mindst ${n}`}
              </option>
            ))}
          </select>
        </label>

        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            router.push(hrefFor({ q: search.trim() }));
          }}
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Navn eller stregkode"
            className="hf-input hf-input--compact w-44"
          />
          <button type="submit" className="hf-btn-secondary hf-btn--compact hf-btn--inline">
            Søg
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="hf-type-caption flex items-center gap-2">
          Størrelse
          <input
            type="range"
            min={MIN_COLS}
            max={MAX_COLS}
            step={1}
            value={MAX_COLS + MIN_COLS - cols}
            onChange={(event) => changeCols(MAX_COLS + MIN_COLS - Number(event.target.value))}
            aria-label="Billedstørrelse"
            className="hf-native-choice w-40 accent-hf-green-dark"
          />
          <span className="w-44 text-text-muted">
            {single ? "Ét billede ad gangen" : `${cols} billeder pr. række`}
          </span>
        </label>

        {canMarkAll && !confirmAll && (
          <button
            type="button"
            disabled={saving || unmarked === 0}
            onClick={() => setConfirmAll(true)}
            className="hf-btn-secondary hf-btn--compact hf-btn--inline"
          >
            Marker alle som godkendt
          </button>
        )}
        {canMarkAll && confirmAll && (
          <span className="flex items-center gap-2">
            <span className="hf-type-small text-hf-black">Godkend de {unmarked} billeder på siden, som endnu ikke er afgjort?</span>
            <button
              type="button"
              onClick={() => void markAll()}
              className="hf-btn-brand hf-btn--compact hf-btn--inline"
            >
              Ja, godkend alle
            </button>
            <button
              type="button"
              onClick={() => setConfirmAll(false)}
              className="hf-btn-secondary hf-btn--compact hf-btn--inline"
            >
              Annullér
            </button>
          </span>
        )}
        {!canEdit && <span className="hf-type-small text-text-muted">Kun administratorer med fuld adgang kan gennemgå billeder.</span>}
        {saving && <span className="hf-type-small text-text-muted">Gemmer…</span>}
      </div>

      {error && <p className="hf-type-small rounded-card bg-hf-red-muted px-3 py-2 text-hf-red-dark">{error}</p>}

      <div
        key={`${query.tab}-${query.sort}-${query.offset}-${query.perPage}-${query.minInteractions}-${query.q}`}
        ref={areaRef}
        className="overflow-y-auto"
        style={{ height: areaHeight ?? undefined, scrollSnapType: single ? "y mandatory" : undefined }}
      >
        {items.length === 0 ? (
          <p className="hf-type-body px-1 py-6 text-text-secondary">
            {query.tab === "review" ? "Ingen billeder til gennemgang med det valgte filter." : "Ingen billeder her endnu."}
          </p>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {items.map((item) => (
              <Card
                key={item.id}
                item={item}
                mark={marks[item.id] ?? null}
                single={single}
                compact={compact}
                height={areaHeight}
                canEdit={canEdit}
                onDecide={decide}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hf-tan-dark pt-3">
        <span className="hf-type-caption">
          {total === 0 ? "0 billeder" : `${from.toLocaleString("da-DK")}–${to.toLocaleString("da-DK")} af ${total.toLocaleString("da-DK")}`}
        </span>
        <nav aria-label="Sider" className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            className="hf-btn-secondary hf-btn--compact hf-btn--inline"
          >
            Forrige
          </button>
          {pageNumbers(currentPage, lastPage).map((entry, index) =>
            entry === "gap" ? (
              <span key={`gap-${index}`} className="hf-type-small px-1 text-text-muted">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                aria-current={entry === currentPage ? "page" : undefined}
                onClick={() => goToPage(entry)}
                className={`hf-choice hf-choice--icon ${entry === currentPage ? "is-selected" : ""}`}
              >
                {entry}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={currentPage >= lastPage}
            onClick={() => goToPage(currentPage + 1)}
            className="hf-btn-secondary hf-btn--compact hf-btn--inline"
          >
            Næste
          </button>
        </nav>
        <span className="hf-type-caption">
          Side {currentPage} af {lastPage}
        </span>
      </div>
    </div>
  );
}

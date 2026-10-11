"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/hf/BottomSheet";
import type { Box } from "@/lib/ai-regions";
import type {
  UncertaintyRow,
  UncertaintySort,
  UncertaintySummary,
  UncertaintyTabKey,
} from "@/lib/uncertainties";
import { ListModeToggle, ListPager, LoadMoreSentinel, useListMode } from "@/components/admin/ListMode";

// Admin "Uncertainties" (docs/DECISIONS.md 2026-09-24/25): fem faner, én række
// pr. produkt, sortering efter usikkerhed (standard, højeste først),
// oprettelsesdato eller navn. "Se produkt" åbner produktsiden som overlay;
// "Rediger" åbner en lightbox med det beskårne foto og røde rammer om de
// områder, AI'en var usikker på.
//
// Hastighed (docs/DECISIONS.md 2026-10-11): listen hentes gradvist i lette
// rækker fra /api/admin/uncertainties — enten som evigheds-scroll eller
// sideinddelt (valg øverst, husket i browseren). Lightboxens detaljer hentes
// først, når man trykker "Rediger".

type Tab = { key: UncertaintyTabKey; label: string };
type Field = { key: string; label: string; kind: "text" | "number" | "textarea" };
type Slice = { total: number; rows: UncertaintySummary[] };

const SORTS: { key: UncertaintySort; label: string }[] = [
  { key: "uncertainty", label: "Usikkerhed" },
  { key: "created", label: "Oprettet" },
  { key: "name", label: "Navn" },
];

function appendUnique(current: UncertaintySummary[], next: UncertaintySummary[]) {
  const seen = new Set(current.map((row) => row.id));
  return [...current, ...next.filter((row) => !seen.has(row.id))];
}

export function UncertaintiesBoard({
  initialRows,
  initialTotal,
  initialCounts,
  pageSize,
  tabs,
  fields,
  target,
  urgentBelow,
  hideBelow,
}: {
  initialRows: UncertaintySummary[];
  initialTotal: number;
  initialCounts: Record<UncertaintyTabKey, number>;
  pageSize: number;
  tabs: readonly Tab[];
  fields: Record<UncertaintyTabKey, Field[]>;
  target: number;
  urgentBelow: number;
  hideBelow: number;
}) {
  const router = useRouter();
  const [mode] = useListMode();
  const [tab, setTab] = useState<UncertaintyTabKey>(tabs[0].key);
  const [sort, setSort] = useState<UncertaintySort>("uncertainty");
  const [counts, setCounts] = useState(initialCounts);
  const [total, setTotal] = useState(initialTotal);
  // To visninger af samme data: scroll-listen vokser, side-listen er ét udsnit.
  const [scrollRows, setScrollRows] = useState(initialRows);
  const [pageRows, setPageRows] = useState(initialRows);
  const [page, setPage] = useState(1);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [productOverlay, setProductOverlay] = useState<string | null>(null);
  const [editing, setEditing] = useState<UncertaintyRow | null>(null);
  // Hæves ved skift af fane/sortering, så forsinkede svar ikke blandes ind.
  const generation = useRef(0);
  const busy = useRef(false);

  async function request(tabKey: UncertaintyTabKey, sortKey: UncertaintySort, offset: number): Promise<Slice> {
    const query = new URLSearchParams({
      tab: tabKey,
      sort: sortKey,
      offset: String(offset),
      limit: String(pageSize),
    });
    const res = await fetch(`/api/admin/uncertainties?${query.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Kunne ikke hente listen");
    return (await res.json()) as Slice;
  }

  // Ny fane eller sortering: start forfra med første udsnit.
  async function start(tabKey: UncertaintyTabKey, sortKey: UncertaintySort) {
    const ticket = ++generation.current;
    busy.current = false;
    setTab(tabKey);
    setSort(sortKey);
    setScrollRows([]);
    setPageRows([]);
    setPage(1);
    setExhausted(false);
    setTotal(counts[tabKey]);
    setError(null);
    setLoading(true);
    try {
      const data = await request(tabKey, sortKey, 0);
      if (ticket !== generation.current) return;
      setTotal(data.total);
      setScrollRows(data.rows);
      setPageRows(data.rows);
      if (data.rows.length === 0) setExhausted(true);
    } catch (e) {
      if (ticket === generation.current) setError(e instanceof Error ? e.message : "Kunne ikke hente listen");
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  }

  // Evigheds-scroll: næste udsnit hægtes på bunden.
  async function loadMore() {
    if (busy.current || loading || exhausted || scrollRows.length >= total) return;
    busy.current = true;
    const ticket = generation.current;
    setLoading(true);
    setError(null);
    try {
      const data = await request(tab, sort, scrollRows.length);
      if (ticket !== generation.current) return;
      setTotal(data.total);
      setScrollRows((current) => appendUnique(current, data.rows));
      if (data.rows.length === 0) setExhausted(true);
    } catch (e) {
      if (ticket === generation.current) setError(e instanceof Error ? e.message : "Kunne ikke hente listen");
    } finally {
      busy.current = false;
      if (ticket === generation.current) setLoading(false);
    }
  }

  // Sideinddelt: hent én bestemt side.
  async function goToPage(next: number) {
    const ticket = generation.current;
    setLoading(true);
    setError(null);
    try {
      const data = await request(tab, sort, (next - 1) * pageSize);
      if (ticket !== generation.current) return;
      const lastPage = Math.max(1, Math.ceil(data.total / pageSize));
      if (next > lastPage) {
        // Siden findes ikke længere (fx efter rettelser): gå til den sidste.
        setLoading(false);
        void goToPage(lastPage);
        return;
      }
      setTotal(data.total);
      setPageRows(data.rows);
      setPage(next);
    } catch (e) {
      if (ticket === generation.current) setError(e instanceof Error ? e.message : "Kunne ikke hente listen");
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  }

  async function openEditor(row: UncertaintySummary) {
    setOpening(row.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/uncertainties/${row.id}?source=${row.source}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Kunne ikke åbne rækken");
      }
      setEditing(((await res.json()) as { row: UncertaintyRow }).row);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Kunne ikke åbne rækken");
    } finally {
      setOpening(null);
    }
  }

  function handleSaved(row: UncertaintyRow) {
    setScrollRows((current) => current.filter((r) => r.id !== row.id));
    setPageRows((current) => current.filter((r) => r.id !== row.id));
    setTotal((current) => Math.max(0, current - 1));
    setCounts((current) => ({ ...current, [row.tab]: Math.max(0, current[row.tab] - 1) }));
    setEditing(null);
    router.refresh();
    // Sideinddelt: fyld siden op igen med næste række.
    if (mode === "pages") void goToPage(page);
  }

  const rows = mode === "scroll" ? scrollRows : pageRows;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const hasMore = !exhausted && scrollRows.length < total;
  const summary =
    mode === "scroll" ? `Viser ${scrollRows.length} af ${total}` : `Side ${page} af ${pages} · ${total} i alt`;

  return (
    <div className="flex flex-col gap-4">
      <ListModeToggle summary={summary} />

      <div className="flex flex-wrap items-center gap-2 border-b border-hf-tan-dark">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => t.key !== tab && void start(t.key, sort)}
            className={`hf-type-body -mb-px border-b-2 px-3 py-2 ${
              tab === t.key
                ? "hf-type-strong border-hf-green-dark text-hf-green-dark"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      <div className="hf-type-small flex flex-wrap items-center gap-2 text-text-muted">
        Sortér:
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => s.key !== sort && void start(tab, s.key)}
            className={`rounded-full border px-2.5 py-1 ${
              sort === s.key
                ? "border-hf-green-dark bg-hf-green-dark text-hf-white"
                : "border-hf-tan-dark text-text-secondary hover:bg-hf-tan"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto">
          Mål: mindst {Math.round(target * 100)} % sikkerhed (vejledende) · under {Math.round(urgentBelow * 100)} % er
          rød · under {Math.round(hideBelow * 100)} % skjules i søgningen, til den er gennemgået
        </span>
      </div>

      {actionError && <p className="hf-type-body text-hf-red-dark">{actionError}</p>}

      {rows.length === 0 ? (
        loading ? (
          <p className="hf-type-body text-text-secondary">Henter…</p>
        ) : error ? (
          <div className="flex items-center gap-3">
            <p className="hf-type-body text-hf-red-dark">{error}</p>
            <button type="button" onClick={() => void start(tab, sort)} className="hf-btn-secondary px-3 py-1">
              Prøv igen
            </button>
          </div>
        ) : (
          <p className="hf-type-body text-text-secondary">Ingen usikre varer i denne fane.</p>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`flex items-center gap-3 rounded-lg border bg-hf-white p-3 ${
                row.urgent ? "border-2 border-hf-red-dark" : "border-hf-tan-dark"
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-hf-tan">
                {row.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="hf-type-body hf-type-strong truncate text-hf-black">{row.productName}</p>
                <p className="hf-type-small text-text-muted">
                  {row.photoTypeLabel && row.tab === "images" ? `${row.photoTypeLabel} · ` : ""}
                  {row.brandName ? `${row.brandName} · ` : ""}
                  oprettet {new Date(row.productCreatedAt).toLocaleDateString("da-DK")} ·{" "}
                  <button
                    type="button"
                    onClick={() => setProductOverlay(row.productId)}
                    className="hf-btn-text text-hf-green-dark"
                  >
                    Se vare
                  </button>
                </p>
              </div>
              <button
                type="button"
                disabled={opening === row.id}
                onClick={() => void openEditor(row)}
                className="hf-btn-secondary px-2.5 py-1 disabled:opacity-50"
              >
                {opening === row.id ? "Åbner…" : "Rediger"}
              </button>
              <span
                className={`hf-type-body hf-type-strong w-14 text-right ${
                  row.urgent ? "text-hf-red-dark" : "text-hf-black"
                }`}
              >
                {row.uncertaintyPercent} %
              </span>
            </div>
          ))}
        </div>
      )}

      {mode === "scroll" && hasMore && rows.length > 0 && (
        <LoadMoreSentinel onVisible={() => void loadMore()} loading={loading} error={error} />
      )}

      {mode === "pages" && rows.length > 0 && (
        <>
          {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
          <ListPager page={page} pages={pages} onPage={(next) => void goToPage(next)} busy={loading} />
        </>
      )}

      {productOverlay && (
        <Overlay onClose={() => setProductOverlay(null)}>
          <iframe
            src={`/admin/products/${productOverlay}`}
            title="Vare"
            className="h-[80vh] w-full rounded-md bg-page-bg"
          />
        </Overlay>
      )}

      {editing && (
        <Overlay onClose={() => setEditing(null)}>
          {editing.source === "matchCheck" ? (
            <ImageLightbox row={editing} onSaved={() => handleSaved(editing)} />
          ) : (
            <EditLightbox row={editing} fields={fields[editing.tab]} onSaved={() => handleSaved(editing)} />
          )}
        </Overlay>
      )}
    </div>
  );
}

// Detaljevinduet er et bundark (KRAV.md "Bundark"): swipe ned eller klik på scrim lukker.
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <BottomSheet size="full" ariaLabel="Detaljer" onClose={onClose}>
      <div className="p-4">{children}</div>
    </BottomSheet>
  );
}

const FULL_IMAGE: Box = { x: 0, y: 0, w: 1, h: 1 };

// Fotoet beskåret til det område, AI'en aflæste (ocrRegion), med røde
// rammer om de usikre områder. Alle koordinater er andele 0–1 af fotoet.
function CroppedPhoto({ src, crop, marks }: { src: string; crop: Box; marks: Box[] }) {
  const [ratio, setRatio] = useState<number | null>(null);
  // Beskæringens højde/bredde-forhold i pixels = (h·H)/(w·W).
  const aspect = ratio !== null ? (crop.h * ratio) / crop.w : null;
  return (
    <div
      className="relative w-full overflow-hidden rounded-md bg-hf-tan"
      style={{ paddingTop: aspect !== null ? `${aspect * 100}%` : "60%" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onLoad={(e) => setRatio(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth)}
        className="absolute max-w-none"
        style={{
          width: `${100 / crop.w}%`,
          left: `${(-crop.x / crop.w) * 100}%`,
          top: `${(-crop.y / crop.h) * 100}%`,
          height: `${100 / crop.h}%`,
        }}
      />
      {marks.map((m, i) => (
        <div
          key={i}
          className="absolute border-2 border-hf-red-dark"
          style={{
            left: `${((m.x - crop.x) / crop.w) * 100}%`,
            top: `${((m.y - crop.y) / crop.h) * 100}%`,
            width: `${(m.w / crop.w) * 100}%`,
            height: `${(m.h / crop.h) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

function EditLightbox({ row, fields, onSaved }: { row: UncertaintyRow; fields: Field[]; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(row.values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uncertainByField = new Map(row.regions.uncertainRegions.map((r) => [r.field, r]));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/uncertainties/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Kunne ikke gemme");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="hf-type-strong pr-8 text-hf-black">{row.productName}</p>
        <p className="hf-type-small text-text-muted">{row.uncertaintyPercent} % usikkerhed</p>
      </div>

      {row.photoUrl ? (
        <CroppedPhoto
          src={row.photoUrl}
          crop={row.regions.ocrRegion ?? FULL_IMAGE}
          marks={row.regions.uncertainRegions}
        />
      ) : (
        <p className="hf-type-body text-text-secondary">Intet foto gemt for denne analyse.</p>
      )}
      {row.photoUrl && !row.regions.ocrRegion && (
        <p className="hf-type-small text-text-muted">
          Analysen er fra før AI&apos;en returnerede koordinater — hele fotoet vises uden røde rammer.
        </p>
      )}

      <div className={fields.length > 1 ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-3"}>
        {fields.map((field) => {
          const uncertain = uncertainByField.get(field.key);
          const inputClass = `hf-type-body w-full rounded-md border bg-page-bg px-2.5 py-1.5 text-hf-black ${
            uncertain ? "border-2 border-hf-red-dark" : "border-hf-tan-dark"
          }`;
          const aiValue = row.aiValues[field.key];
          return (
            <label key={field.key} className="hf-type-small flex flex-col gap-1 text-text-secondary">
              {field.label}
              {field.kind === "textarea" ? (
                <textarea
                  rows={6}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  className={inputClass}
                />
              ) : (
                <input
                  inputMode={field.kind === "number" ? "decimal" : undefined}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  className={inputClass}
                />
              )}
              {uncertain?.reason && <span className="text-hf-red-dark">{uncertain.reason}</span>}
              {aiValue && aiValue !== (values[field.key] ?? "") && (
                <span className="text-text-muted">AI læste: {aiValue}</span>
              )}
            </label>
          );
        })}
      </div>

      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="hf-btn-primary px-4 py-2"
        >
          {saving ? "Gemmer…" : "Gem rettelse"}
        </button>
      </div>
    </div>
  );
}

// Billeder-fanen: fotoet fra oprettelsen ved siden af forsidefotoet, som
// billedrobotten har sammenlignet det med. Afgørelsen gemmes via samme
// route som Kvalitetskontrol (træningsdata, rører aldrig produktets felter).
function ImageLightbox({ row, onSaved }: { row: UncertaintyRow; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(verdict: "CORRECT" | "WRONG" | "UNCERTAIN") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quality-control/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Kunne ikke gemme");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setSaving(false);
    }
  }

  const photos: { label: string; url: string | null }[] = [
    { label: row.photoTypeLabel ?? "Foto", url: row.photoUrl },
    { label: "Forsidefoto", url: row.comparePhotoUrl },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="hf-type-strong pr-8 text-hf-black">{row.productName}</p>
        <p className="hf-type-small text-text-muted">
          {row.uncertaintyPercent} % usikkerhed på, at fotoet hører til varen
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {photos.map((photo) => (
          <div key={photo.label} className="flex flex-col gap-1">
            <p className="hf-type-small text-text-secondary">{photo.label}</p>
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-hf-tan">
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="hf-type-small text-text-muted">Intet foto</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => decide("WRONG")}
          className="hf-type-body rounded-md border border-hf-red-dark px-3 py-2 text-hf-red-dark disabled:opacity-50"
        >
          Forkert vare
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => decide("UNCERTAIN")}
          className="hf-type-body rounded-md border border-hf-tan-dark px-3 py-2 text-text-secondary disabled:opacity-50"
        >
          Usikker
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => decide("CORRECT")}
          className="hf-btn-primary px-3 py-2"
        >
          Samme vare
        </button>
      </div>
    </div>
  );
}

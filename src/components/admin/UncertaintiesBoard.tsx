"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Box } from "@/lib/ai-regions";
import type { UncertaintyRow, UncertaintyTabKey } from "@/lib/uncertainties";

// Admin "Uncertainties" (docs/DECISIONS.md 2026-09-24/25): fem faner, én række
// pr. produkt, sortering efter usikkerhed (standard, højeste først),
// oprettelsesdato eller navn. "Se produkt" åbner produktsiden som overlay;
// "Rediger" åbner en lightbox med det beskårne foto og røde rammer om de
// områder, AI'en var usikker på.

type Tab = { key: UncertaintyTabKey; label: string };
type Field = { key: string; label: string; kind: "text" | "number" | "textarea" };
type SortKey = "uncertainty" | "created" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "uncertainty", label: "Usikkerhed" },
  { key: "created", label: "Oprettet" },
  { key: "name", label: "Navn" },
];

export function UncertaintiesBoard({
  rows: initialRows,
  tabs,
  fields,
  target,
  urgentBelow,
  hideBelow,
}: {
  rows: UncertaintyRow[];
  tabs: readonly Tab[];
  fields: Record<UncertaintyTabKey, Field[]>;
  target: number;
  urgentBelow: number;
  hideBelow: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [tab, setTab] = useState<UncertaintyTabKey>(tabs[0].key);
  const [sort, setSort] = useState<SortKey>("uncertainty");
  const [productOverlay, setProductOverlay] = useState<string | null>(null);
  const [editing, setEditing] = useState<UncertaintyRow | null>(null);

  const visible = useMemo(() => {
    const list = rows.filter((r) => r.tab === tab);
    // Under 70 % (urgent) står altid øverst, uanset sortering.
    return list.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      if (sort === "created") return b.productCreatedAt.localeCompare(a.productCreatedAt);
      if (sort === "name") return a.productName.localeCompare(b.productName, "da");
      return b.uncertaintyPercent - a.uncertaintyPercent;
    });
  }, [rows, tab, sort]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-hf-tan-dark">
        {tabs.map((t) => {
          const count = rows.filter((r) => r.tab === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`hf-type-body -mb-px border-b-2 px-3 py-2 ${
                tab === t.key
                  ? "hf-type-strong border-hf-green-dark text-hf-green-dark"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="hf-type-small flex flex-wrap items-center gap-2 text-text-muted">
        Sortér:
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSort(s.key)}
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

      {visible.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen usikre produkter i denne fane.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((row) => (
            <div
              key={row.id}
              className={`flex items-center gap-3 rounded-lg border bg-hf-white p-3 ${
                row.urgent ? "border-2 border-hf-red-dark" : "border-hf-tan-dark"
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-hf-tan">
                {row.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.thumbnailUrl} alt="" className="h-full w-full object-contain" />
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
                    Se produkt
                  </button>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(row)}
                className="hf-btn-secondary px-2.5 py-1"
              >
                Rediger
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

      {productOverlay && (
        <Overlay onClose={() => setProductOverlay(null)}>
          <iframe
            src={`/admin/products/${productOverlay}`}
            title="Produkt"
            className="h-[80vh] w-full rounded-md bg-page-bg"
          />
        </Overlay>
      )}

      {editing && (
        <Overlay onClose={() => setEditing(null)}>
          {editing.source === "matchCheck" ? (
            <ImageLightbox
              row={editing}
              onSaved={() => {
                setRows((current) => current.filter((r) => r.id !== editing.id));
                setEditing(null);
                router.refresh();
              }}
            />
          ) : (
            <EditLightbox
              row={editing}
              fields={fields[editing.tab]}
              onSaved={() => {
                setRows((current) => current.filter((r) => r.id !== editing.id));
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-hf-black/60 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-lg bg-hf-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="hf-type-body-lg absolute right-3 top-2 text-text-muted hover:text-text-primary"
          aria-label="Luk"
        >
          ×
        </button>
        {children}
      </div>
    </div>
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
          className="hf-btn-primary px-4 py-2 disabled:opacity-50"
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
          {row.uncertaintyPercent} % usikkerhed på, at fotoet hører til produktet
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
          Forkert produkt
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
          className="hf-btn-primary px-3 py-2 disabled:opacity-50"
        >
          Samme produkt
        </button>
      </div>
    </div>
  );
}

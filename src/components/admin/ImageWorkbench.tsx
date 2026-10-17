"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { CHECKER_STYLE } from "@/components/admin/ImageCompare";

// Fælles arbejdsflade til Billedbehandling (docs/DECISIONS.md 2026-10-17):
// bruges af både "Fritlagte billeder" (original ↔ rembg) og "Billedforslag"
// (nuværende ↔ forslag), så de to sider har samme udseende og værktøjer.
// - Grid med valgfri størrelse (dropdown) og valgfri baggrund bag billederne.
// - Hold musen over en vare: mørkt lag med Afvis og Accepter ved siden af hinanden.
// - "Vælg" slår markering til: klik hvor som helst på kortet, Shift for et
//   interval. Så snart noget er valgt, står to store knapper fast øverst.
// - Klik på et billede (uden Vælg) åbner en stor side-om-side-visning.

export type WorkbenchSlide = { src: string | null; label: string };
export type WorkbenchAlternative = { key: string; src: string | null; label: string };
export type WorkbenchItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  left: WorkbenchSlide;
  right: WorkbenchSlide;
  // Flere forslag til højre side (Billedforslag); det valgte sendes med ved Accepter.
  alternatives?: WorkbenchAlternative[];
};

// KEEP = behold det nuværende billede og forkast forslaget (kun Billedforslag).
export type WorkbenchAction = "ACCEPT" | "REJECT" | "KEEP";

type Props = {
  items: WorkbenchItem[];
  // Returnerer id'erne, der blev behandlet (de forsvinder fra listen).
  onDecide: (ids: string[], action: WorkbenchAction, alternativeKeys: Record<string, string>) => Promise<string[]>;
  acceptLabel?: string;
  rejectLabel?: string;
  // Giver et tredje valg på kortet og i den store visning: behold det nuværende billede.
  keepLabel?: string;
  emptyText: string;
  storageKey: string;
  // Fanen viser behandlede varer: ingen knapper på kortene, kun visning.
  readOnly?: boolean;
};

const SIZES = [
  { value: "s", label: "Små", min: 220 },
  { value: "m", label: "Mellem", min: 340 },
  { value: "l", label: "Store", min: 480 },
  { value: "xl", label: "Meget store", min: 720 },
] as const;

const BACKGROUNDS: { value: string; label: string; style: CSSProperties }[] = [
  { value: "checker", label: "Ternet", style: CHECKER_STYLE },
  { value: "white", label: "Hvid", style: { backgroundColor: "#ffffff" } },
  { value: "black", label: "Sort", style: { backgroundColor: "#000000" } },
  { value: "red", label: "Rød", style: { backgroundColor: "#d32f2f" } },
  { value: "blue", label: "Blå", style: { backgroundColor: "#1976d2" } },
];

const PAGE_STEP = 60;

function remember(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function Pic({ slide, bg, onOpen }: { slide: WorkbenchSlide; bg: CSSProperties; onOpen?: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg"
        style={bg}
        onClick={onOpen}
      >
        {slide.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.src} alt={slide.label} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <span className="hf-type-small text-text-muted">Intet billede</span>
        )}
      </div>
      <span className="hf-type-small truncate text-center text-text-muted">{slide.label}</span>
    </div>
  );
}

export function ImageWorkbench({ items: initialItems, onDecide, acceptLabel = "Accepter", rejectLabel = "Afvis", keepLabel, emptyText, storageKey, readOnly = false }: Props) {
  const [items, setItems] = useState(initialItems);
  const [size, setSize] = useState<(typeof SIZES)[number]["value"]>("m");
  const [bgKey, setBgKey] = useState("checker");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastIndex = useRef<number | null>(null);

  useEffect(() => {
    try {
      const savedSize = window.localStorage.getItem(`${storageKey}-size`);
      const savedBg = window.localStorage.getItem(`${storageKey}-bg`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- husket valg (kun i browseren)
      if (SIZES.some((option) => option.value === savedSize)) setSize(savedSize as (typeof SIZES)[number]["value"]);
      if (BACKGROUNDS.some((option) => option.value === savedBg)) setBgKey(savedBg as string);
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- serverens liste vinder efter en opdatering
    setItems(initialItems);
  }, [initialItems]);

  const bg = BACKGROUNDS.find((option) => option.value === bgKey)?.style ?? CHECKER_STYLE;
  const minWidth = SIZES.find((option) => option.value === size)?.min ?? 340;
  const shown = items.slice(0, visibleCount);
  const selectionActive = !readOnly && (selectMode || selected.size > 0);

  const altKeyFor = useCallback(
    (item: WorkbenchItem) => (item.alternatives?.length ? (picked[item.id] ?? item.alternatives[0].key) : undefined),
    [picked],
  );
  const rightSlide = useCallback(
    (item: WorkbenchItem): WorkbenchSlide => {
      const alt = item.alternatives?.find((candidate) => candidate.key === altKeyFor(item));
      return alt ? { src: alt.src, label: alt.label } : item.right;
    },
    [altKeyFor],
  );

  const decide = useCallback(
    async (ids: string[], action: WorkbenchAction) => {
      if (busy || ids.length === 0) return;
      setBusy(true);
      setError(null);
      try {
        const keys: Record<string, string> = {};
        for (const id of ids) {
          const item = items.find((candidate) => candidate.id === id);
          const key = item ? altKeyFor(item) : undefined;
          if (key) keys[id] = key;
        }
        const done = new Set(await onDecide(ids, action, keys));
        if (done.size < ids.length) setError(`${ids.length - done.size} kunne ikke behandles.`);
        setItems((list) => list.filter((item) => !done.has(item.id)));
        setSelected((current) => new Set([...current].filter((id) => !done.has(id))));
      } catch {
        setError("Handlingen mislykkedes (serverfejl). Prøv igen.");
      } finally {
        setBusy(false);
      }
    },
    [altKeyFor, busy, items, onDecide],
  );

  const toggle = (index: number, event: MouseEvent) => {
    const id = shown[index].id;
    setSelected((current) => {
      const next = new Set(current);
      if (event.shiftKey && lastIndex.current !== null) {
        const [from, to] = [Math.min(lastIndex.current, index), Math.max(lastIndex.current, index)];
        for (let i = from; i <= to; i++) next.add(shown[i].id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastIndex.current = index;
  };

  // Hold lysboksen inden for listen, når en vare forsvinder.
  useEffect(() => {
    if (lightbox === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- klem indekset ind i listen
    if (items.length === 0) setLightbox(null);
    else if (lightbox >= items.length) setLightbox(items.length - 1);
  }, [items.length, lightbox]);

  const step = useCallback(
    (delta: number) => setLightbox((current) => (current === null || items.length === 0 ? current : (current + delta + items.length) % items.length)),
    [items.length],
  );
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, step]);

  const selectedIds = useMemo(() => items.filter((item) => selected.has(item.id)).map((item) => item.id), [items, selected]);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <p className="hf-type-caption">
        {items.length} {items.length === 1 ? "vare" : "varer"}
      </p>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        <label className="hf-type-body flex items-center gap-2">
          <span className="text-text-secondary">Størrelse</span>
          <select
            value={size}
            onChange={(event) => {
              setSize(event.target.value as (typeof SIZES)[number]["value"]);
              remember(`${storageKey}-size`, event.target.value);
            }}
            className="hf-input"
          >
            {SIZES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="hf-type-body flex items-center gap-2">
          <span className="text-text-secondary">Baggrund</span>
          <select
            value={bgKey}
            onChange={(event) => {
              setBgKey(event.target.value);
              remember(`${storageKey}-bg`, event.target.value);
            }}
            className="hf-input"
          >
            {BACKGROUNDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {!readOnly && (
          <>
            <button
              type="button"
              className="hf-choice"
              aria-pressed={selectMode}
              onClick={() => {
                setSelectMode((on) => !on);
                if (selectMode) setSelected(new Set());
              }}
            >
              Vælg
            </button>
            {selectionActive && (
              <button type="button" className="hf-btn-text" onClick={() => setSelected(new Set(items.map((item) => item.id)))}>
                Marker alle ({items.length})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {toolbar}
        <p className="hf-type-body text-text-secondary">{emptyText}</p>
      </div>
    );
  }

  const current = lightbox !== null ? items[lightbox] ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      {toolbar}

      {selectionActive && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 rounded-lg bg-hf-white p-3 shadow-md">
          <span className="hf-type-strong text-hf-black">{selectedIds.length} valgt</span>
          <div className="ml-auto flex w-full gap-3 sm:w-auto">
            <button type="button" className="hf-btn-danger hf-btn--large flex-1 sm:min-w-40" disabled={busy || selectedIds.length === 0} onClick={() => decide(selectedIds, "REJECT")}>
              {rejectLabel}
            </button>
            <button type="button" className="hf-btn-primary hf-btn--large flex-1 sm:min-w-40" disabled={busy || selectedIds.length === 0} onClick={() => decide(selectedIds, "ACCEPT")}>
              {acceptLabel}
            </button>
          </div>
        </div>
      )}

      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minWidth * 1.8}px), 1fr))` }}>
        {shown.map((item, index) => {
          const isSelected = selected.has(item.id);
          return (
            <div
              key={item.id}
              className={`group hf-panel hf-panel--form relative h-full ${isSelected ? "outline outline-4 outline-hf-green" : ""} ${selectionActive ? "cursor-pointer" : ""}`}
              onClick={selectionActive ? (event) => toggle(index, event) : undefined}
            >
              <div className="min-w-0">
                <p className="hf-type-strong truncate text-hf-black">{item.title}</p>
                {item.subtitle && <p className="hf-type-caption truncate">{item.subtitle}</p>}
              </div>
              <div className="flex gap-2">
                <Pic slide={item.left} bg={bg} onOpen={selectionActive ? undefined : () => setLightbox(index)} />
                <Pic slide={rightSlide(item)} bg={bg} onOpen={selectionActive ? undefined : () => setLightbox(index)} />
              </div>
              {item.alternatives && item.alternatives.length > 1 && (
                <div className="hf-pick-strip" aria-label="Alternativer" onClick={(event) => event.stopPropagation()}>
                  {item.alternatives.map((alt, altIndex) => (
                    <button
                      key={alt.key}
                      type="button"
                      onClick={() => setPicked((state) => ({ ...state, [item.id]: alt.key }))}
                      aria-label={`Vis alternativ ${altIndex + 1}: ${alt.label}`}
                      aria-pressed={alt.key === altKeyFor(item)}
                      className={`hf-pick-thumb ${alt.key === altKeyFor(item) ? "is-selected" : ""}`}
                    >
                      {alt.src && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={alt.src} alt="" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {selectionActive && (
                <div
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={`Vælg ${item.title}`}
                  className={`pointer-events-none absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md border-2 ${
                    isSelected ? "border-hf-green-dark bg-hf-green-dark text-hf-white" : "border-hf-white bg-hf-black/40 text-transparent"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </div>
              )}

              {!readOnly && !selectionActive && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 rounded-[inherit] bg-hf-black/55 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  {/* eslint-disable-next-line no-restricted-syntax -- ligger på mørkt lag; .hf-btn-danger er gennemsigtig og ville være ulæselig */}
                  <button type="button" className="hf-btn-danger hf-btn--large bg-hf-white" disabled={busy} onClick={() => decide([item.id], "REJECT")}>
                    {rejectLabel}
                  </button>
                  {keepLabel && (
                    <button type="button" className="hf-btn-secondary hf-btn--large" disabled={busy} onClick={() => decide([item.id], "KEEP")}>
                      {keepLabel}
                    </button>
                  )}
                  <button type="button" className="hf-btn-primary hf-btn--large" disabled={busy} onClick={() => decide([item.id], "ACCEPT")}>
                    {acceptLabel}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {items.length > shown.length && (
        <div className="flex justify-center">
          <button type="button" className="hf-btn-secondary" onClick={() => setVisibleCount((count) => count + PAGE_STEP)}>
            Vis flere ({items.length - shown.length} mere)
          </button>
        </div>
      )}

      {current && (
        <div className="fixed inset-0 z-50 flex h-dvh flex-col gap-3 bg-hf-black/85 p-4" role="dialog" aria-modal="true" aria-label="Billede i stor størrelse">
          <div className="flex shrink-0 items-start justify-between gap-4 text-hf-white">
            <div className="min-w-0">
              <p className="hf-type-strong truncate">{current.title}</p>
              {current.subtitle && <p className="hf-type-small opacity-80">{current.subtitle}</p>}
              <p className="hf-type-small opacity-80">
                {(lightbox ?? 0) + 1} af {items.length}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="hf-type-small flex items-center gap-2">
                <span>Baggrund</span>
                <select
                  value={bgKey}
                  onChange={(event) => {
                    setBgKey(event.target.value);
                    remember(`${storageKey}-bg`, event.target.value);
                  }}
                  className="hf-input"
                >
                  {BACKGROUNDS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => setLightbox(null)} className="hf-btn-icon" aria-label="Luk">
                ✕
              </button>
            </div>
          </div>

          <div className="relative grid min-h-0 flex-1 grid-cols-2 gap-4 px-12">
            {items.length > 1 && (
              <button type="button" onClick={() => step(-1)} aria-label="Forrige" className="hf-pick-arrow hf-btn-icon is-prev opacity-100">
                ‹
              </button>
            )}
            {[current.left, rightSlide(current)].map((slide, idx) => (
              <div key={idx} className="flex min-h-0 min-w-0 flex-col gap-2">
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg" style={bg}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.src ?? ""} alt={slide.label} className="h-full w-full object-contain" />
                </div>
                <p className="hf-type-small shrink-0 truncate text-center text-hf-white">{slide.label}</p>
              </div>
            ))}
            {items.length > 1 && (
              <button type="button" onClick={() => step(1)} aria-label="Næste" className="hf-pick-arrow hf-btn-icon is-next opacity-100">
                ›
              </button>
            )}
          </div>

          {!readOnly && (
            <div className="mx-auto flex w-full max-w-xl shrink-0 gap-2">
              {/* eslint-disable-next-line no-restricted-syntax -- ligger på mørkt lag; .hf-btn-danger er gennemsigtig og ville være ulæselig */}
              <button type="button" onClick={() => decide([current.id], "REJECT")} disabled={busy} className="hf-btn-danger hf-btn--large flex-1 bg-hf-white">
                {rejectLabel}
              </button>
              {keepLabel && (
                <button type="button" onClick={() => decide([current.id], "KEEP")} disabled={busy} className="hf-btn-secondary hf-btn--large flex-1">
                  {keepLabel}
                </button>
              )}
              <button type="button" onClick={() => decide([current.id], "ACCEPT")} disabled={busy} className="hf-btn-primary hf-btn--large flex-1">
                {acceptLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

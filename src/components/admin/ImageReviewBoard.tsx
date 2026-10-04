"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

// Fælles gennemsynsvisning til Billedbehandling (docs/DECISIONS.md 2026-10-04):
// størrelsesvælger (2/4/8 firkanter = 1/2/4 varer pr. side), paginering og en
// lightbox med Afvis/Godkend, piletaster og tal i bunden. Bruges af
// Billedforslag og Logoer — handlingerne leveres udefra.

export type ReviewSlide = { src: string | null; label: string };
export type ReviewItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  slides: ReviewSlide[];
};

type Props = {
  items: ReviewItem[];
  approveLabel: string;
  rejectLabel: string;
  onApprove: (id: string) => Promise<boolean>;
  onReject: (id: string) => Promise<boolean>;
  emptyText: string;
  // Valgfri ekstra knap pr. kort (fx "Se alternativer" på logoer).
  extra?: (item: ReviewItem) => ReactNode;
  storageKey: string;
};

const SIZES = [
  { squares: 2, perPage: 1, label: "2 firkanter: én vare pr. side i fuld størrelse" },
  { squares: 4, perPage: 2, label: "4 firkanter: to varer pr. side" },
  { squares: 8, perPage: 4, label: "8 firkanter: fire varer pr. side" },
] as const;

function SizeIcon({ squares }: { squares: number }) {
  const cols = 2;
  const rows = squares / cols;
  const gap = rows > 2 ? 1.5 : 2.5;
  const side = Math.min((24 - gap) / 2, (24 - gap * (rows - 1)) / rows);
  const top = (24 - (rows * side + (rows - 1) * gap)) / 2;
  const left = (24 - (2 * side + gap)) / 2;
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      {Array.from({ length: squares }).map((_, i) => (
        <rect key={i} x={left + (i % cols) * (side + gap)} y={top + Math.floor(i / cols) * (side + gap)} width={side} height={side} rx={1} />
      ))}
    </svg>
  );
}

function Pic({ slide, className, onClick }: { slide: ReviewSlide; className: string; onClick?: () => void }) {
  const inner = slide.src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={slide.src} alt={slide.label} className="h-full w-full object-contain" />
  ) : (
    <span className="hf-type-small text-text-muted">Intet billede</span>
  );
  const box = `flex items-center justify-center overflow-hidden rounded-lg bg-hf-tan ${className}`;
  return onClick && slide.src ? (
    <button type="button" onClick={onClick} className={`${box} cursor-zoom-in`} aria-label={`Forstør: ${slide.label}`}>
      {inner}
    </button>
  ) : (
    <div className={box}>{inner}</div>
  );
}

export function ImageReviewBoard({ items: initialItems, approveLabel, rejectLabel, onApprove, onReject, emptyText, extra, storageKey }: Props) {
  const [items, setItems] = useState(initialItems);
  const [sizeIdx, setSizeIdx] = useState(2);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  // Serverens liste vinder, når siden genindlæses efter en handling.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- følger serverdata
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(storageKey));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- husket valg (kun i browseren)
      if (saved >= 0 && saved <= 2 && window.localStorage.getItem(storageKey) !== null) setSizeIdx(saved);
    } catch {}
  }, [storageKey]);

  const perPage = SIZES[sizeIdx].perPage;
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(page, pageCount - 1);
  const visible = items.slice(safePage * perPage, safePage * perPage + perPage);

  // Lightbox-billeder: alle billeder på tværs af varerne, kun dem der findes.
  const flat = items.flatMap((item, itemIndex) =>
    item.slides.flatMap((slide) => (slide.src ? [{ item, itemIndex, slide }] : [])),
  );

  const chooseSize = (idx: number) => {
    // Bliv ved samme vare, når størrelsen skifter.
    const firstIndex = safePage * perPage;
    setSizeIdx(idx);
    setPage(Math.floor(firstIndex / SIZES[idx].perPage));
    try {
      window.localStorage.setItem(storageKey, String(idx));
    } catch {}
  };

  const act = useCallback(
    async (item: ReviewItem, kind: "approve" | "reject") => {
      if (busy) return;
      setBusy(true);
      try {
        const ok = await (kind === "approve" ? onApprove(item.id) : onReject(item.id));
        if (ok) setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      } finally {
        setBusy(false);
      }
    },
    [busy, onApprove, onReject],
  );

  const step = useCallback(
    (delta: number) => {
      setLightbox((current) => (current === null || flat.length === 0 ? current : (current + delta + flat.length) % flat.length));
    },
    [flat.length],
  );

  // Hold lightboxen inden for listen, når et billede forsvinder efter Afvis/Godkend.
  useEffect(() => {
    if (lightbox === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- klem indekset ind i listen
    if (flat.length === 0) setLightbox(null);
    else if (lightbox >= flat.length) setLightbox(flat.length - 1);
  }, [flat.length, lightbox]);

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

  if (items.length === 0) return <p className="hf-type-body text-text-secondary">{emptyText}</p>;

  const single = perPage === 1;
  const current = lightbox !== null ? flat[lightbox] : null;
  // Tal i bunden: højst 9 ad gangen omkring det aktuelle billede.
  const numbers: number[] = [];
  if (lightbox !== null) {
    const start = Math.max(0, Math.min(lightbox - 4, flat.length - 9));
    for (let i = start; i < Math.min(flat.length, start + 9); i++) numbers.push(i);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="hf-type-small text-text-secondary">
          {items.length} {items.length === 1 ? "vare" : "varer"} · side {safePage + 1} af {pageCount}
        </p>
        <div className="flex gap-1 rounded-md border border-hf-tan-dark bg-hf-white p-1" role="group" aria-label="Størrelse">
          {SIZES.map((size, idx) => (
            <button
              key={size.squares}
              type="button"
              title={size.label}
              aria-label={size.label}
              aria-pressed={sizeIdx === idx}
              onClick={() => chooseSize(idx)}
              className={`flex h-9 w-9 items-center justify-center rounded ${
                sizeIdx === idx ? "bg-hf-green-dark text-hf-white" : "text-text-secondary hover:bg-hf-tan"
              }`}
            >
              <SizeIcon squares={size.squares} />
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-4 ${perPage === 4 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {visible.map((item) => {
          const firstIdx = (slide: ReviewSlide) => flat.findIndex((entry) => entry.item.id === item.id && entry.slide === slide);
          return (
            <div key={item.id} className="flex flex-col gap-4 hf-surface p-4">
              <div>
                <p className="hf-type-strong text-hf-black">{item.title}</p>
                {item.subtitle && <p className="hf-type-small text-text-secondary">{item.subtitle}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {item.slides.map((slide) => (
                  <div key={slide.label} className="flex flex-col items-center gap-1">
                    <Pic
                      slide={slide}
                      className={`aspect-square w-full ${single ? "" : perPage === 2 ? "max-w-md" : "max-w-xs"}`}
                      onClick={() => setLightbox(firstIdx(slide))}
                    />
                    <span className="hf-type-small text-text-muted">{slide.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => act(item, "reject")}
                  disabled={busy}
                  className="hf-type-body hf-control flex-1 rounded-md border border-hf-tan-dark px-3 text-hf-red-dark disabled:opacity-60"
                >
                  {rejectLabel}
                </button>
                <button type="button" onClick={() => act(item, "approve")} disabled={busy} className="hf-btn-primary flex-1 px-3 py-1.5 disabled:opacity-60">
                  {approveLabel}
                </button>
              </div>
              {extra?.(item)}
            </div>
          );
        })}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className="hf-btn-text disabled:opacity-40">
            ‹ Forrige
          </button>
          <span className="hf-type-small text-text-secondary">
            {safePage + 1} / {pageCount}
          </span>
          <button type="button" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1} className="hf-btn-text disabled:opacity-40">
            Næste ›
          </button>
        </div>
      )}

      {current && (
        <div className="fixed inset-0 z-50 flex flex-col bg-hf-black/85" role="dialog" aria-modal="true" aria-label="Billede i stor størrelse">
          <div className="flex items-start justify-between gap-4 p-4 text-hf-white">
            <div className="min-w-0">
              <p className="hf-type-strong truncate">{current.item.title}</p>
              <p className="hf-type-small opacity-80">
                {current.slide.label}
                {current.item.subtitle ? ` · ${current.item.subtitle}` : ""}
              </p>
            </div>
            <button type="button" onClick={() => setLightbox(null)} className="hf-type-body shrink-0 px-2" aria-label="Luk">
              ✕
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14">
            {flat.length > 1 && (
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Forrige billede"
                className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-hf-white/90 text-hf-black"
              >
                ‹
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.slide.src ?? ""} alt={current.slide.label} className="max-h-full max-w-full rounded-lg bg-hf-white object-contain" />
            {flat.length > 1 && (
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Næste billede"
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-hf-white/90 text-hf-black"
              >
                ›
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {numbers[0] > 0 && <span className="hf-type-small text-hf-white/70">…</span>}
              {numbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLightbox(n)}
                  aria-current={n === lightbox}
                  className={`hf-type-small h-8 min-w-8 rounded-full px-2 ${n === lightbox ? "bg-hf-white text-hf-black hf-type-strong" : "text-hf-white/80 hover:bg-hf-white/20"}`}
                >
                  {n + 1}
                </button>
              ))}
              {numbers.length > 0 && numbers[numbers.length - 1] < flat.length - 1 && <span className="hf-type-small text-hf-white/70">…</span>}
            </div>
            <div className="mx-auto flex w-full max-w-xl gap-2">
              <button
                type="button"
                onClick={() => act(current.item, "reject")}
                disabled={busy}
                className="hf-type-body hf-control flex-1 rounded-md border border-hf-tan-dark bg-hf-white px-3 text-hf-red-dark disabled:opacity-60"
              >
                {rejectLabel}
              </button>
              <button type="button" onClick={() => act(current.item, "approve")} disabled={busy} className="hf-btn-primary flex-1 px-3 py-1.5 disabled:opacity-60">
                {approveLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

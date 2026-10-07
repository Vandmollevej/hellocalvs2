"use client";

import { useCallback, useEffect, useState } from "react";
import { ReviewSizePicker, useReviewSize } from "@/components/admin/ReviewSizePicker";

// Fælles gennemsynsvisning til Billedbehandling (docs/DECISIONS.md 2026-10-04):
// størrelsesvælger (2/4/8 firkanter = 1/2/4 varer pr. side), paginering og en
// lightbox med Afvis/Godkend, piletaster og tal i bunden. Bruges af
// Billedforslag og Logoer — handlingerne leveres udefra. Har en vare
// `alternatives`, står originalen (slides[0]) ved siden af det valgte
// alternativ med pile midt på billedet og en række af 6 alternativer under;
// "godkend" gælder det viste alternativ. Alle klasser er fælles (.hf-pick-*).

export type ReviewSlide = { src: string | null; label: string; key?: string };
export type ReviewItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  slides: ReviewSlide[];
  alternatives?: ReviewSlide[];
};

type Props = {
  items: ReviewItem[];
  approveLabel: string;
  rejectLabel: string;
  onApprove: (id: string, alternativeKey?: string) => Promise<boolean>;
  onReject: (id: string) => Promise<boolean>;
  emptyText: string;
  storageKey: string;
};

const STRIP = 6;

function Pic({ slide, onClick }: { slide: ReviewSlide; onClick?: () => void }) {
  const inner = slide.src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={slide.src} alt={slide.label} />
  ) : (
    <span className="hf-type-small text-text-muted">Intet billede</span>
  );
  return onClick && slide.src ? (
    <button type="button" onClick={onClick} className="hf-pick-frame cursor-zoom-in" aria-label={`Forstør: ${slide.label}`}>
      {inner}
    </button>
  ) : (
    <div className="hf-pick-frame">{inner}</div>
  );
}

export function ImageReviewBoard({ items: initialItems, approveLabel, rejectLabel, onApprove, onReject, emptyText, storageKey }: Props) {
  const [items, setItems] = useState(initialItems);
  const { sizeIdx, perPage, choose } = useReviewSize(storageKey);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  // Valgt alternativ pr. vare (indeks i item.alternatives).
  const [picked, setPicked] = useState<Record<string, number>>({});

  // Serverens liste vinder, når siden genindlæses efter en handling.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- følger serverdata
    setItems(initialItems);
  }, [initialItems]);

  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(page, pageCount - 1);
  const visible = items.slice(safePage * perPage, safePage * perPage + perPage);

  const pickedIndex = (item: ReviewItem) => {
    const count = item.alternatives?.length ?? 0;
    return count === 0 ? 0 : Math.min(picked[item.id] ?? 0, count - 1);
  };
  const shownSlides = (item: ReviewItem): ReviewSlide[] =>
    item.alternatives?.length ? [item.slides[0], item.alternatives[pickedIndex(item)]] : item.slides;
  const pickedKey = (item: ReviewItem) => (item.alternatives?.length ? item.alternatives[pickedIndex(item)].key : undefined);
  const movePick = (item: ReviewItem, delta: number) => {
    const count = item.alternatives?.length ?? 0;
    if (count < 2) return;
    setPicked((current) => ({ ...current, [item.id]: (pickedIndex(item) + delta + count) % count }));
  };

  // Lightbox-billeder: original + alle alternativer (eller slides) for hver vare.
  const flat = items.flatMap((item) =>
    (item.alternatives?.length ? [item.slides[0], ...item.alternatives] : item.slides).flatMap((slide) =>
      slide.src ? [{ item, slide }] : [],
    ),
  );

  const chooseSize = (idx: number) => {
    // Bliv ved samme vare, når størrelsen skifter.
    const firstIndex = safePage * perPage;
    choose(idx);
    setPage(Math.floor(firstIndex / [1, 2, 4][idx]));
  };

  const act = useCallback(
    async (item: ReviewItem, kind: "approve" | "reject", alternativeKey?: string) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const ok = await (kind === "approve" ? onApprove(item.id, alternativeKey) : onReject(item.id));
        if (ok) setItems((current) => current.filter((candidate) => candidate.id !== item.id));
        else setError("Handlingen blev ikke gemt. Prøv igen.");
      } catch {
        setError("Handlingen mislykkedes (serverfejl). Prøv igen.");
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
        <ReviewSizePicker sizeIdx={sizeIdx} onChoose={chooseSize} />
      </div>

      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}

      <div className={`grid gap-4 ${perPage === 4 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {visible.map((item) => {
          const alternatives = item.alternatives ?? [];
          const index = pickedIndex(item);
          const stripStart = Math.max(0, Math.min(index - Math.floor(STRIP / 2), alternatives.length - STRIP));
          const shown = shownSlides(item);
          const lightboxIndex = (slide: ReviewSlide) =>
            flat.findIndex((entry) => entry.item.id === item.id && entry.slide.src === slide.src);
          return (
            <div key={item.id} className="hf-panel hf-panel--form">
              <div>
                <p className="hf-type-strong text-hf-black">{item.title}</p>
                {item.subtitle && <p className="hf-type-small text-text-secondary">{item.subtitle}</p>}
              </div>
              <div className="hf-pick-grid">
                {shown.map((slide, slideIdx) => (
                  <div key={slideIdx} className="flex flex-col items-center gap-1">
                    <div className="relative w-full">
                      <Pic slide={slide} onClick={() => setLightbox(lightboxIndex(slide))} />
                      {alternatives.length > 1 && slideIdx === 1 && (
                        <>
                          <button type="button" onClick={() => movePick(item, -1)} aria-label="Forrige alternativ" className="hf-pick-arrow hf-btn-icon is-prev">
                            ‹
                          </button>
                          <button type="button" onClick={() => movePick(item, 1)} aria-label="Næste alternativ" className="hf-pick-arrow hf-btn-icon is-next">
                            ›
                          </button>
                        </>
                      )}
                    </div>
                    <span className="hf-type-small text-text-muted">{slide.label}</span>
                  </div>
                ))}
              </div>
              {alternatives.length > 1 && (
                <div className="hf-pick-strip" aria-label="Alternativer">
                  {alternatives.slice(stripStart, stripStart + STRIP).map((alt, offset) => {
                    const altIndex = stripStart + offset;
                    return (
                      <button
                        key={alt.key ?? altIndex}
                        type="button"
                        onClick={() => setPicked((currentPicked) => ({ ...currentPicked, [item.id]: altIndex }))}
                        aria-label={`Vis alternativ ${altIndex + 1}: ${alt.label}`}
                        aria-pressed={altIndex === index}
                        className={`hf-pick-thumb ${altIndex === index ? "is-selected" : ""}`}
                      >
                        {alt.src && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={alt.src} alt="" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => act(item, "reject")} disabled={busy} className="hf-btn-danger h-12 flex-1 px-3">
                  {rejectLabel}
                </button>
                <button type="button" onClick={() => act(item, "approve", pickedKey(item))} disabled={busy} className="hf-btn-primary h-12 flex-1 px-3">
                  {approveLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className="hf-btn-text">
            ‹ Forrige
          </button>
          <span className="hf-type-small text-text-secondary">
            {safePage + 1} / {pageCount}
          </span>
          <button type="button" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1} className="hf-btn-text">
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
            <button type="button" onClick={() => setLightbox(null)} className="hf-btn-icon" aria-label="Luk">
              ✕
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14">
            {flat.length > 1 && (
              <button type="button" onClick={() => step(-1)} aria-label="Forrige billede" className="hf-pick-arrow hf-btn-icon is-prev opacity-100">
                ‹
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.slide.src ?? ""} alt={current.slide.label} className="max-h-full max-w-full rounded-lg bg-hf-white object-contain" />
            {flat.length > 1 && (
              <button type="button" onClick={() => step(1)} aria-label="Næste billede" className="hf-pick-arrow hf-btn-icon is-next opacity-100">
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
              <button type="button" onClick={() => act(current.item, "reject")} disabled={busy} className="hf-btn-danger h-12 flex-1 bg-hf-white px-3">
                {rejectLabel}
              </button>
              <button
                type="button"
                onClick={() => act(current.item, "approve", current.slide.key ?? pickedKey(current.item))}
                disabled={busy}
                className="hf-btn-primary h-12 flex-1 px-3"
              >
                {approveLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

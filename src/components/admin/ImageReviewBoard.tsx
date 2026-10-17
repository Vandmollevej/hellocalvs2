"use client";

import { useCallback, useEffect, useState } from "react";
import { BulkActionsBar, BulkRow, BulkSelection } from "@/components/admin/BulkSelection";

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
  // Vælg på det nuværende billede (i stedet for forslaget): beholder det og forkaster forslaget.
  onKeep?: (id: string) => Promise<boolean>;
  emptyText: string;
  storageKey: string;
  // Varernes id'er: rækkerne kan markeres og behandles samlet (Handlinger,
  // docs/DECISIONS.md 2026-10-11). Ikke for logoer, hvor id'et er et mærke.
  bulkProducts?: boolean;
};

const STRIP = 6;
// "Vis antal produkter": op til 12 (3 rækker à 4) før der sideinddeles.
const COUNT_OPTIONS = [1, 2, 4, 8, 12];
const DEFAULT_COUNT = 12;

function Pic({ slide, onClick }: { slide: ReviewSlide; onClick?: () => void }) {
  const inner = slide.src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={slide.src} alt={slide.label} />
  ) : (
    <span className="hf-type-small text-text-muted">Intet billede</span>
  );
  return onClick && slide.src ? (
    <button type="button" onClick={onClick} className="hf-btn-text hf-pick-frame" aria-label={`Forstør: ${slide.label}`}>
      {inner}
    </button>
  ) : (
    <div className="hf-pick-frame">{inner}</div>
  );
}

export function ImageReviewBoard({ items: initialItems, approveLabel, rejectLabel, onApprove, onReject, onKeep, emptyText, storageKey, bulkProducts = false }: Props) {
  const [items, setItems] = useState(initialItems);
  const [perPage, setPerPage] = useState(DEFAULT_COUNT);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(`${storageKey}-count`));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- husket valg (kun i browseren)
      if (COUNT_OPTIONS.includes(saved)) setPerPage(saved);
    } catch {}
  }, [storageKey]);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  // Valgt alternativ pr. vare (indeks i item.alternatives).
  // Hvilket billede i lysboksen der er markeret (standard: forslaget til højre).
  const [chosenCurrent, setChosenCurrent] = useState<Record<string, boolean>>({});
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

  const chooseCount = (count: number) => {
    // Bliv ved samme vare, når antallet skifter.
    const firstIndex = safePage * perPage;
    setPerPage(count);
    setPage(Math.floor(firstIndex / count));
    try {
      window.localStorage.setItem(`${storageKey}-count`, String(count));
    } catch {}
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

  const actKeep = async (item: ReviewItem) => {
    if (busy || !onKeep) return;
    setBusy(true);
    setError(null);
    try {
      if (await onKeep(item.id)) setItems((list) => list.filter((candidate) => candidate.id !== item.id));
      else setError("Handlingen blev ikke gemt. Prøv igen.");
    } catch {
      setError("Handlingen mislykkedes (serverfejl). Prøv igen.");
    } finally {
      setBusy(false);
    }
  };

  const step = useCallback(
    (delta: number) => {
      setLightbox((current) => (current === null || items.length === 0 ? current : (current + delta + items.length) % items.length));
    },
    [items.length],
  );

  // Hold lightboxen inden for listen, når et billede forsvinder efter Afvis/Godkend.
  useEffect(() => {
    if (lightbox === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- klem indekset ind i listen
    if (items.length === 0) setLightbox(null);
    else if (lightbox >= items.length) setLightbox(items.length - 1);
  }, [items.length, lightbox]);

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

  const current = lightbox !== null ? items[lightbox] ?? null : null;
  // Lightboxen viser ét sæt ad gangen: nuværende billede og det valgte forslag
  // side om side; pilene bladrer til næste vare. "Godkend" gælder det viste forslag.
  const lightboxSlides: ReviewSlide[] = current ? shownSlides(current).filter((slide) => slide.src) : [];
  const lightboxAlternatives = current?.alternatives ?? [];
  const keepCurrent = Boolean(current && onKeep && chosenCurrent[current.id]);
  // Tal i bunden: højst 9 varer ad gangen omkring den aktuelle.
  const numbers: number[] = [];
  if (lightbox !== null) {
    const start = Math.max(0, Math.min(lightbox - 4, items.length - 9));
    for (let i = start; i < Math.min(items.length, start + 9); i++) numbers.push(i);
  }

  const board = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="hf-type-caption">
          {items.length} {items.length === 1 ? "vare" : "varer"} · side {safePage + 1} af {pageCount}
        </p>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <label className="hf-type-body flex items-center gap-2">
            <span className="text-text-secondary">Vis antal produkter</span>
            <select value={perPage} onChange={(event) => chooseCount(Number(event.target.value))} className="hf-input">
              {COUNT_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          {bulkProducts && <BulkActionsBar />}
        </div>
      </div>

      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}

      <div className={`grid gap-4 ${perPage >= 4 ? "md:grid-cols-2 2xl:grid-cols-4" : perPage === 2 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {visible.map((item) => {
          const alternatives = item.alternatives ?? [];
          const index = pickedIndex(item);
          const stripStart = Math.max(0, Math.min(index - Math.floor(STRIP / 2), alternatives.length - STRIP));
          const shown = shownSlides(item);
          const lightboxIndex = () => items.findIndex((entry) => entry.id === item.id);
          return (
            <BulkRow as="div" key={item.id} id={item.id} ignoreInteractive className="hf-panel hf-panel--form">
              <div>
                <p className="hf-type-strong text-hf-black">{item.title}</p>
                {item.subtitle && <p className="hf-type-caption">{item.subtitle}</p>}
              </div>
              <div className="hf-pick-grid">
                {shown.map((slide, slideIdx) => (
                  <div key={slideIdx} className="flex flex-col items-center gap-1">
                    <div className="relative w-full">
                      <Pic slide={slide} onClick={() => setLightbox(lightboxIndex())} />
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
                <button type="button" onClick={() => act(item, "reject")} disabled={busy} className="hf-btn-danger flex-1 hf-btn--large">
                  {rejectLabel}
                </button>
                <button type="button" onClick={() => act(item, "approve", pickedKey(item))} disabled={busy} className="hf-btn-primary flex-1 hf-btn--large">
                  {approveLabel}
                </button>
              </div>
            </BulkRow>
          );
        })}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className="hf-btn-text">
            ‹ Forrige
          </button>
          <span className="hf-type-caption">
            {safePage + 1} / {pageCount}
          </span>
          <button type="button" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1} className="hf-btn-text">
            Næste ›
          </button>
        </div>
      )}

      {current && (
        <div className="fixed inset-0 z-50 flex h-dvh flex-col gap-3 bg-hf-black/85 p-4" role="dialog" aria-modal="true" aria-label="Billede i stor størrelse">
          <div className="flex shrink-0 items-start justify-between gap-4 text-hf-white">
            <div className="min-w-0">
              <p className="hf-type-strong truncate">{current.title}</p>
              {current.subtitle && <p className="hf-type-small opacity-80">{current.subtitle}</p>}
            </div>
            <button type="button" onClick={() => setLightbox(null)} className="hf-btn-icon" aria-label="Luk">
              ✕
            </button>
          </div>

          <div className="relative grid min-h-0 flex-1 grid-cols-2 gap-4 px-12">
            {items.length > 1 && (
              <button type="button" onClick={() => step(-1)} aria-label="Forrige produkt" className="hf-pick-arrow hf-btn-icon is-prev opacity-100">
                ‹
              </button>
            )}
            {lightboxSlides.map((slide, idx) => {
              const isProposal = idx === lightboxSlides.length - 1 && lightboxSlides.length > 1;
              const selectable = lightboxSlides.length > 1 && (isProposal || Boolean(onKeep));
              const isSelected = isProposal ? !keepCurrent : keepCurrent;
              return (
                <div key={idx} className="flex min-h-0 min-w-0 flex-col gap-2">
                  <div
                    role="button"
                    tabIndex={selectable ? 0 : -1}
                    aria-pressed={isSelected}
                    aria-label={isProposal ? "Markér forslaget" : "Markér det nuværende billede"}
                    onClick={() => selectable && setChosenCurrent((state) => ({ ...state, [current.id]: !isProposal }))}
                    onKeyDown={(event) => {
                      if (selectable && (event.key === "Enter" || event.key === " ")) setChosenCurrent((state) => ({ ...state, [current.id]: !isProposal }));
                    }}
                    className={`flex min-h-0 flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-hf-white ${isSelected && lightboxSlides.length > 1 ? "outline outline-4 outline-hf-green" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slide.src ?? ""} alt={slide.label} className="h-full w-full object-contain" />
                  </div>
                  <p className="hf-type-small shrink-0 truncate text-center text-hf-white">{slide.label}</p>
                </div>
              );
            })}
            {items.length > 1 && (
              <button type="button" onClick={() => step(1)} aria-label="Næste produkt" className="hf-pick-arrow hf-btn-icon is-next opacity-100">
                ›
              </button>
            )}
          </div>

          {lightboxAlternatives.length > 1 && (
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-2" aria-label="Alternativer">
              {lightboxAlternatives.map((alt, altIndex) => (
                <button
                  key={alt.key ?? altIndex}
                  type="button"
                  onClick={() => setPicked((currentPicked) => ({ ...currentPicked, [current.id]: altIndex }))}
                  aria-label={`Vis alternativ ${altIndex + 1}: ${alt.label}`}
                  aria-pressed={altIndex === pickedIndex(current)}
                  className={`hf-pick-thumb h-14 w-14 ${altIndex === pickedIndex(current) ? "is-selected" : ""}`}
                >
                  {alt.src && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={alt.src} alt="" />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5">
            {numbers[0] > 0 && <span className="hf-type-small text-hf-white/70">…</span>}
            {numbers.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLightbox(n)}
                aria-current={n === lightbox}
                aria-pressed={n === lightbox}
                className="hf-choice"
              >
                {n + 1}
              </button>
            ))}
            {numbers.length > 0 && numbers[numbers.length - 1] < items.length - 1 && <span className="hf-type-small text-hf-white/70">…</span>}
          </div>

          <div className="mx-auto flex w-full max-w-xl shrink-0 gap-2">
            {/* eslint-disable-next-line no-restricted-syntax -- ligger på det mørke fuldskærmsoverlay; .hf-btn-danger er gennemsigtig og ville være ulæselig */}
            <button type="button" onClick={() => act(current, "reject")} disabled={busy} className="hf-btn-danger hf-btn--large flex-1 bg-hf-white">
              {rejectLabel}
            </button>
            <button
              type="button"
              onClick={() => (keepCurrent && onKeep ? actKeep(current) : act(current, "approve", pickedKey(current)))}
              disabled={busy}
              className="hf-btn-primary hf-btn--large flex-1"
            >
              {approveLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return bulkProducts ? (
    <BulkSelection kind="product" ids={visible.map((item) => item.id)}>
      {board}
    </BulkSelection>
  ) : (
    board
  );
}

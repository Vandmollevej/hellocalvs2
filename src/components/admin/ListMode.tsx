"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

// Fælles valg for lange admin-lister (docs/DECISIONS.md 2026-10-11): enten
// evigheds-scroll (indlæser gradvist, mens man scroller) eller sideinddelt
// visning. Valget huskes i browseren og gælder alle lister.

export type ListMode = "scroll" | "pages";

const STORAGE_KEY = "hc-admin-list-mode";
const CHANGE_EVENT = "hc-admin-list-mode-change";

// Bruges, hvis browseren ikke tillader localStorage (privat vindue o.l.).
let memoryMode: ListMode | null = null;

function readMode(): ListMode {
  if (memoryMode) return memoryMode;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "pages" ? "pages" : "scroll";
  } catch {
    return "scroll";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useListMode(): [ListMode, (mode: ListMode) => void] {
  // Serveren og første rendering bruger "scroll", så der ikke opstår hydration-fejl.
  const mode = useSyncExternalStore(subscribe, readMode, (): ListMode => "scroll");
  function setMode(next: ListMode) {
    memoryMode = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Valget huskes kun, til siden lukkes.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return [mode, setMode];
}

const OPTIONS: { key: ListMode; label: string }[] = [
  { key: "scroll", label: "Evigheds-scroll" },
  { key: "pages", label: "Sideinddelt" },
];

// Valget øverst på listen. `summary` vises til højre (fx "Viser 40 af 812").
export function ListModeToggle({ summary }: { summary?: string }) {
  const [mode, setMode] = useListMode();
  return (
    <div className="hf-type-small flex flex-wrap items-center gap-2 text-text-muted">
      Visning:
      {OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={mode === option.key}
          onClick={() => setMode(option.key)}
          className={`rounded-full border px-2.5 py-1 ${
            mode === option.key
              ? "border-hf-green-dark bg-hf-green-dark text-hf-white"
              : "border-hf-tan-dark text-text-secondary hover:bg-hf-tan"
          }`}
        >
          {option.label}
        </button>
      ))}
      {summary && <span className="ml-auto">{summary}</span>}
    </div>
  );
}

// Nederst i en scroll-liste: når den kommer i nærheden af skærmen, hentes
// næste bidrag. Knappen er en reserve, hvis browseren ikke kan observere.
export function LoadMoreSentinel({
  onVisible,
  loading,
  error,
}: {
  onVisible: () => void;
  loading: boolean;
  error?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onVisible);
  useEffect(() => {
    callback.current = onVisible;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node || loading || error || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, error]);

  return (
    <div ref={ref} className="hf-type-small flex flex-col items-center gap-2 py-4 text-text-muted">
      {error && <p className="text-hf-red-dark">{error}</p>}
      {loading ? (
        <span>Henter flere…</span>
      ) : (
        <button type="button" onClick={onVisible} className="hf-btn-secondary px-3 py-1">
          {error ? "Prøv igen" : "Hent flere"}
        </button>
      )}
    </div>
  );
}

// Sideinddelt visning (knapper): bruges, hvor siden ikke selv har sidelinks.
export function ListPager({
  page,
  pages,
  onPage,
  busy,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  busy?: boolean;
}) {
  if (pages <= 1) return null;
  return (
    <div className="hf-type-small flex items-center justify-between text-text-secondary">
      {page > 1 ? (
        <button type="button" disabled={busy} onClick={() => onPage(page - 1)} className="text-hf-green-dark disabled:opacity-50">
          ← Forrige
        </button>
      ) : (
        <span />
      )}
      <span>
        Side {page} af {pages}
      </span>
      {page < pages ? (
        <button type="button" disabled={busy} onClick={() => onPage(page + 1)} className="text-hf-green-dark disabled:opacity-50">
          Næste →
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { productDatabaseHref, type ProductDatabaseFilters } from "@/lib/admin-product-database-query";
import { useConfirmSheet } from "@/lib/use-confirm-sheet";

// "Gem visning" + "Visninger" over produktlisten (docs/DECISIONS.md
// 2026-10-07): gemmer og henter hele opsætningen (søgning, filtre, sortering,
// visning og synlige felter) for den indloggede admin.

const SCOPE = "product-database";

type SavedView = { id: string; name: string; query: string };

function queryOf(filters: ProductDatabaseFilters) {
  return productDatabaseHref({ ...filters, page: 1 }).split("?")[1] ?? "";
}

export function SavedViewsControls({ filters }: { filters: ProductDatabaseFilters }) {
  const router = useRouter();
  const { ask, sheet } = useConfirmSheet();
  const rootRef = useRef<HTMLDivElement>(null);
  const [views, setViews] = useState<SavedView[]>([]);
  const [menu, setMenu] = useState<"views" | "save" | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const current = queryOf(filters);
  const active = views.find((view) => view.query === current);

  async function refresh() {
    try {
      const response = await fetch(`/api/admin/saved-views?scope=${SCOPE}`, { cache: "no-store" });
      if (response.ok) setViews(((await response.json()) as { views: SavedView[] }).views);
    } catch {
      // Listen forbliver som den var.
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- henter gemte visninger ved første visning
    void refresh();
  }, []);

  useEffect(() => {
    if (!menu) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: SCOPE, name: trimmed, query: current }),
      });
      const body = (await response.json().catch(() => ({}))) as { views?: SavedView[]; message?: string };
      if (!response.ok) {
        setMessage(body.message ?? "Kunne ikke gemme");
        return;
      }
      if (body.views) setViews(body.views);
      setName("");
      setMenu(null);
    } finally {
      setBusy(false);
    }
  }

  function remove(view: SavedView) {
    ask(`Slet visningen "${view.name}"?`, () => {
      void (async () => {
        const response = await fetch(`/api/admin/saved-views?id=${encodeURIComponent(view.id)}`, { method: "DELETE" });
        if (response.ok) setViews((list) => list.filter((v) => v.id !== view.id));
      })();
    });
  }

  function apply(view: SavedView) {
    setMenu(null);
    router.push(view.query ? `/admin/product-database/products?${view.query}` : "/admin/product-database/products", { scroll: false });
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      {sheet}
      <button
        type="button"
        aria-expanded={menu === "save"}
        onClick={() => {
          setMessage(null);
          setName(active?.name ?? "");
          setMenu(menu === "save" ? null : "save");
        }}
        className="hf-btn-brand hf-btn--compact"
      >
        Gem visning
      </button>
      <button
        type="button"
        aria-expanded={menu === "views"}
        onClick={() => {
          void refresh();
          setMenu(menu === "views" ? null : "views");
        }}
        className="hf-type-body hf-type-strong flex items-center gap-2 rounded-md border border-hf-tan-dark bg-hf-white px-4 py-2.5 text-hf-black hover:border-hf-green"
      >
        {active ? active.name : "Visninger"}
        <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${menu === "views" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {menu === "save" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] shadow-lg hf-panel"
        >
          <label className="flex flex-col gap-1">
            <span className="hf-type-label text-text-secondary">Navn på visning</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              placeholder="Fx Uden billede, Bilka"
              className="hf-field hf-type-body rounded-md border border-hf-tan-dark bg-page-bg px-3 text-hf-black outline-none focus:border-hf-green"
            />
          </label>
          <p className="hf-type-small text-text-muted">
            Gemmer søgning, filtre, sortering, visning og de valgte felter. Et eksisterende navn overskrives.
          </p>
          {message && <p className="hf-type-small text-hf-red-dark">{message}</p>}
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="hf-btn-brand hf-btn--compact"
          >
            {busy ? "Gemmer…" : "Gem"}
          </button>
        </form>
      )}

      {menu === "views" && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden shadow-lg hf-surface">
          {views.length === 0 ? (
            <p className="hf-type-small px-4 py-3 text-text-muted">Ingen gemte visninger endnu.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border-strong overflow-y-auto">
              {views.map((view) => (
                <li key={view.id} className="flex items-center hover:bg-hf-tan">
                  <button
                    type="button"
                    onClick={() => apply(view)}
                    aria-current={active?.id === view.id}
                    className={`hf-type-body min-w-0 flex-1 truncate px-4 py-2.5 text-left text-hf-black ${active?.id === view.id ? "hf-type-strong" : ""}`}
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(view)}
                    aria-label={`Slet ${view.name}`}
                    title="Slet visning"
                    className="shrink-0 px-3 py-2.5 text-text-muted hover:text-hf-red-dark"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

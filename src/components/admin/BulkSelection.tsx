"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  BULK_ACTION_HINTS,
  BULK_ACTION_LABELS,
  sendBulkAction,
  type BulkAction,
  type BulkKind,
} from "@/lib/admin-bulk-actions";

// Markering af rækker i admin-lister over varer og retter (docs/DECISIONS.md
// 2026-10-11): klik med Ctrl/⌘ markerer flere enkeltvis, Shift markerer en hel
// stribe fra den sidst markerede, og knappen "Handlinger" (vises altid)
// udfører en handling på alle markerede. Almindeligt klik åbner rækken som
// før, indtil noget er markeret — så skifter et klik på en række til at
// markere/afmarkere. "Markér" i bjælken gør det samme uden tastatur (mobil).
// Ingen afkrydsningsfelter (docs/DECISIONS.md 2026-09-02): markeringen er en
// grøn ramme og en grøn prik på rækken.

type Selection = {
  kind: BulkKind;
  deletedView: boolean;
  count: number;
  selectedIds: string[];
  selectMode: boolean;
  isSelected: (id: string) => boolean;
  clickRow: (event: MouseEvent, id: string) => void;
  setSelectMode: (value: boolean) => void;
  selectAll: () => void;
  clear: () => void;
};

const noop = () => {};
const IDLE: Selection = {
  kind: "product",
  deletedView: false,
  count: 0,
  selectedIds: [],
  selectMode: false,
  isSelected: () => false,
  clickRow: noop,
  setSelectMode: noop,
  selectAll: noop,
  clear: noop,
};
const SelectionContext = createContext<Selection>(IDLE);

export function BulkSelection({
  kind,
  ids,
  deletedView = false,
  children,
}: {
  kind: BulkKind;
  // Rækkernes id'er i visningsrækkefølge (bruges til Shift-striber).
  ids: string[];
  deletedView?: boolean;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const anchor = useRef<string | null>(null);

  // Kun id'er, der stadig står på siden (efter søgning, sidebladring, opdatering).
  const selectedIds = useMemo(() => ids.filter((id) => selected.has(id)), [ids, selected]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectionActive = selectedIds.length > 0;

  const clear = useCallback(() => {
    setSelected(new Set());
    setSelectMode(false);
    anchor.current = null;
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(ids));
    setSelectMode(true);
  }, [ids]);

  const clickRow = useCallback(
    (event: MouseEvent, id: string) => {
      const target = event.target as HTMLElement | null;
      // Til/fra-knappen og andre knapper på rækken har deres egen funktion.
      if (target?.closest("[data-bulk-ignore]")) return;
      const range = event.shiftKey;
      const toggle = event.ctrlKey || event.metaKey;
      // Uden tast og uden markering åbner rækken som normalt.
      if (!range && !toggle && !selectMode && !selectionActive) return;
      event.preventDefault();
      event.stopPropagation();

      setSelected((previous) => {
        const next = new Set(ids.filter((value) => previous.has(value)));
        const from = anchor.current === null ? -1 : ids.indexOf(anchor.current);
        const to = ids.indexOf(id);
        if (range && from >= 0 && to >= 0) {
          const stripe = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
          // Shift alene erstatter markeringen med striben; Ctrl+Shift lægger den til.
          if (!toggle) next.clear();
          for (const value of stripe) next.add(value);
          return next;
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        anchor.current = id;
        return next;
      });
    },
    [ids, selectMode, selectionActive],
  );

  // Esc rydder markeringen.
  useEffect(() => {
    if (!selectionActive && !selectMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectionActive, selectMode, clear]);

  const value = useMemo<Selection>(
    () => ({
      kind,
      deletedView,
      count: selectedIds.length,
      selectedIds,
      selectMode,
      isSelected: (id) => selectedSet.has(id),
      clickRow,
      setSelectMode,
      selectAll,
      clear,
    }),
    [kind, deletedView, selectedIds, selectedSet, selectMode, clickRow, selectAll, clear],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

// En række i listen: håndterer klik/Ctrl/Shift og viser markering og mangler.
// `problem` giver den tynde røde kant (docs/DECISIONS.md 2026-10-11).
export function BulkRow({
  id,
  className = "",
  style,
  problem = false,
  children,
}: {
  id: string;
  className?: string;
  style?: CSSProperties;
  problem?: boolean;
  children: ReactNode;
}) {
  const selection = useContext(SelectionContext);
  const selected = selection.isSelected(id);
  const frame = selected
    ? "bg-hf-tan ring-2 ring-inset ring-hf-green"
    : problem
      ? "ring-1 ring-inset ring-hf-red-dark"
      : "";
  return (
    <li
      className={`relative ${className} ${frame}`}
      style={style}
      data-selected={selected || undefined}
      onClickCapture={(event) => selection.clickRow(event, id)}
      // Shift + klik må ikke markere tekst hen over rækkerne.
      onMouseDown={(event) => {
        if (event.shiftKey) event.preventDefault();
      }}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1 top-1 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-hf-green text-hf-white"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        </span>
      )}
      {children}
    </li>
  );
}

const LIVE_ACTIONS: BulkAction[] = ["DISABLE", "ENABLE", "APPROVE", "REVIEW", "DELETE"];
const DELETED_ACTIONS: BulkAction[] = ["RESTORE"];

// Bjælken over listen: antal markerede og "Handlinger"-menuen (vises altid).
export function BulkActionsBar() {
  const selection = useContext(SelectionContext);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const actions = selection.deletedView ? DELETED_ACTIONS : LIVE_ACTIONS;
  const none = selection.count === 0;

  async function run(action: BulkAction) {
    setOpen(false);
    if (none) return;
    const noun = selection.count === 1 ? "række" : "rækker";
    if (action === "DELETE" && !window.confirm(`Slet ${selection.count} ${noun}? De flyttes til Slettede og kan gendannes.`)) return;
    setBusy(true);
    const result = await sendBulkAction({ kind: selection.kind, action, ids: selection.selectedIds });
    setBusy(false);
    if (!result.ok) {
      setMessage({ text: result.message, failed: true });
      return;
    }
    setMessage({ text: `${BULK_ACTION_LABELS[action]}: ${result.changed} ${result.changed === 1 ? "række" : "rækker"} ændret`, failed: false });
    selection.clear();
    router.refresh();
  }

  return (
    <div className="hf-surface flex flex-wrap items-center justify-between gap-3 px-4 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <p className="hf-type-body text-text-secondary" role="status">
          {none ? (
            "Ingen markeret"
          ) : (
            <>
              <span className="hf-type-strong text-hf-black">{selection.count}</span> markeret
            </>
          )}
        </p>
        <button
          type="button"
          aria-pressed={selection.selectMode}
          onClick={() => selection.setSelectMode(!selection.selectMode)}
          className="hf-choice"
        >
          Markér
        </button>
        <button type="button" onClick={selection.selectAll} className="hf-btn-text text-hf-green-dark">
          Markér alle på siden
        </button>
        {!none && (
          <button type="button" onClick={selection.clear} className="hf-btn-text text-hf-green-dark">
            Ryd
          </button>
        )}
        {none && <p className="hf-type-small hidden text-text-muted lg:block">Ctrl/⌘ + klik markerer flere · Shift + klik markerer en stribe</p>}
        {message && (
          <p className={`hf-type-small ${message.failed ? "text-hf-red-dark" : "text-hf-green-dark"}`} role="status">
            {message.text}
          </p>
        )}
      </div>

      <div ref={menu} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={busy}
          onClick={() => setOpen((value) => !value)}
          className="hf-btn-brand hf-btn--inline hf-btn--large"
        >
          Handlinger
          <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div role="menu" className="hf-surface absolute right-0 z-30 mt-2 w-72 overflow-hidden py-1 shadow-lg">
            {none && <p className="hf-type-small border-b border-hf-tan-dark px-4 py-2 text-text-muted">Markér først en eller flere rækker.</p>}
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                role="menuitem"
                disabled={none}
                onClick={() => void run(action)}
                className={`hf-navrow flex-col items-start justify-center text-left disabled:opacity-50 ${
                  action === "DELETE" ? "text-hf-red-dark" : ""
                }`}
              >
                <span className="hf-type-body">{BULK_ACTION_LABELS[action]}</span>
                <span className="hf-type-small text-text-muted">{BULK_ACTION_HINTS[action]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Shared layout persistence for StatCardsGrid and the unused-cards page
// (src/lib/stat-cards.ts re-exports everything here), so both
// read/write the same localStorage key without duplicating the logic.

export type StatLayoutItem = { type: "stat"; key: string };
export type StatHeaderLayoutItem = { type: "header"; id: string; text: string };
export type StatDividerLayoutItem = { type: "divider"; id: string };
/**
 * An explicitly empty half-width slot. The grid is two columns of physical
 * slots, so a gap the user leaves (e.g. a card moved to the right column) is
 * part of the saved layout and must never be compacted away.
 */
export type StatEmptyLayoutItem = { type: "empty"; id: string };
/**
 * A fold-out section (accordion) in the grid. It is stored flat: the
 * `accordion` item opens it and the matching `accordionEnd` (same id) closes
 * it; everything in between is inside it. No nesting. `open` is the user's
 * last choice and is saved with the layout.
 */
export type StatAccordionLayoutItem = { type: "accordion"; id: string; title: string; open: boolean };
export type StatAccordionEndLayoutItem = { type: "accordionEnd"; id: string };
export type StatGridLayoutItem =
  | StatLayoutItem
  | StatHeaderLayoutItem
  | StatDividerLayoutItem
  | StatEmptyLayoutItem
  | StatAccordionLayoutItem
  | StatAccordionEndLayoutItem;

export const STAT_LAYOUT_STORAGE_KEY = "hellocal.statistik.layout";

function makeLayoutId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function makeEmptyStatSlot(): StatEmptyLayoutItem {
  return { type: "empty", id: makeLayoutId() };
}

/** Half-width items occupy one of the two column slots; headers/dividers span the full row. */
export function isHalfWidthStatItem(item: StatGridLayoutItem): item is StatLayoutItem | StatEmptyLayoutItem {
  return item.type === "stat" || item.type === "empty";
}

function trailingRunLength(layout: StatGridLayoutItem[]) {
  let count = 0;
  for (let i = layout.length - 1; i >= 0 && isHalfWidthStatItem(layout[i]); i -= 1) count += 1;
  return count;
}

/**
 * Index range [start, end] of an accordion's own markers, or null when the
 * id isn't an accordion in this layout. The items strictly between them are
 * its contents.
 */
export function accordionRange(layout: StatGridLayoutItem[], id: string): { start: number; end: number } | null {
  const start = layout.findIndex((item) => item.type === "accordion" && item.id === id);
  if (start < 0) return null;
  const end = layout.findIndex((item, index) => index > start && item.type === "accordionEnd" && item.id === id);
  return end < 0 ? null : { start, end };
}

/** Id of the accordion the item at `index` sits inside, or null at top level. */
export function accordionAt(layout: StatGridLayoutItem[], index: number): string | null {
  let inside: string | null = null;
  for (let i = 0; i < index && i < layout.length; i += 1) {
    const item = layout[i];
    if (item.type === "accordion") inside = item.id;
    else if (item.type === "accordionEnd") inside = null;
  }
  return inside;
}

/**
 * Makes accordion markers consistent: every start gets exactly one matching
 * end, stray ends are dropped and a start inside another accordion closes
 * the outer one first (no nesting). Whole empty rows just before an end are
 * dropped, like the empty rows at the very end of the grid.
 */
function repairAccordions(layout: StatGridLayoutItem[]): StatGridLayoutItem[] {
  const next: StatGridLayoutItem[] = [];
  let openId: string | null = null;
  const seen = new Set<string>();
  function close() {
    if (openId === null) return;
    while (
      next.length >= 2 &&
      next[next.length - 1].type === "empty" &&
      next[next.length - 2].type === "empty"
    ) {
      next.splice(-2, 2);
    }
    next.push({ type: "accordionEnd", id: openId });
    openId = null;
  }
  for (const item of layout) {
    if (item.type === "accordion") {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      close();
      next.push(item);
      openId = item.id;
      continue;
    }
    if (item.type === "accordionEnd") {
      if (item.id === openId) close();
      continue;
    }
    next.push(item);
  }
  close();
  return next;
}

/**
 * Makes every run of half-width slots between full-width items an even length
 * (so each row has exactly a left and a right slot) and drops completely empty
 * rows at the very end. Empty slots anywhere else are kept — they are the
 * user's layout. Older saved layouts without empty slots migrate through this.
 */
export function normalizeStatLayout(layout: StatGridLayoutItem[]): StatGridLayoutItem[] {
  const usedIds = new Set(layout.map((item) => ("id" in item ? item.id : item.key)));
  // Deterministic ids for filler slots, so the server render and the client's
  // first render of the same layout agree (no hydration mismatch).
  function filler(): StatEmptyLayoutItem {
    let n = next.length;
    while (usedIds.has(`pad-${n}`)) n += 1;
    usedIds.add(`pad-${n}`);
    return { type: "empty", id: `pad-${n}` };
  }
  const next: StatGridLayoutItem[] = [];
  let runLength = 0;
  for (const item of repairAccordions(layout)) {
    if (isHalfWidthStatItem(item)) {
      next.push(item);
      runLength += 1;
      continue;
    }
    if (runLength % 2 !== 0) next.push(filler());
    runLength = 0;
    next.push(item);
  }
  if (runLength % 2 !== 0) next.push(filler());

  while (
    trailingRunLength(next) >= 2 &&
    next[next.length - 1].type === "empty" &&
    next[next.length - 2].type === "empty"
  ) {
    next.splice(-2, 2);
  }
  return next;
}

/**
 * Drops every completely empty row (two empty slots side by side) from the
 * normalized layout, wherever it sits. Used when editing ends and when a
 * saved layout is loaded, so deleted cards never leave blank space behind.
 * A row with one card and one empty slot is the user's layout and stays.
 */
export function dropEmptyRows(layout: StatGridLayoutItem[]): StatGridLayoutItem[] {
  const next: StatGridLayoutItem[] = [];
  let run: StatGridLayoutItem[] = [];
  function flush() {
    for (let i = 0; i < run.length; i += 2) {
      const pair = run.slice(i, i + 2);
      if (pair.length === 2 && pair.every((item) => item.type === "empty")) continue;
      next.push(...pair);
    }
    run = [];
  }
  for (const item of normalizeStatLayout(layout)) {
    if (isHalfWidthStatItem(item)) {
      run.push(item);
      continue;
    }
    flush();
    next.push(item);
  }
  flush();
  return next;
}

export function loadStatLayout(defaultLayout: StatGridLayoutItem[]): StatGridLayoutItem[] {
  if (typeof window === "undefined") return normalizeStatLayout(defaultLayout);
  try {
    const raw = window.localStorage.getItem(STAT_LAYOUT_STORAGE_KEY);
    if (!raw) return normalizeStatLayout(defaultLayout);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return dropEmptyRows(parsed);
    return normalizeStatLayout(defaultLayout);
  } catch {
    return normalizeStatLayout(defaultLayout);
  }
}

export function saveStatLayout(layout: StatGridLayoutItem[]) {
  try {
    window.localStorage.setItem(STAT_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeStatLayout(layout)));
  } catch {
    // localStorage unavailable — ignore.
  }
}

/**
 * Adds a stat card at the bottom of the active layout if it isn't already
 * there — into the free right slot of the last row when there is one.
 */
export function addStatCardToLayout(defaultLayout: StatGridLayoutItem[], key: string): StatGridLayoutItem[] {
  const current = loadStatLayout(defaultLayout);
  const alreadyActive = current.some((item) => item.type === "stat" && item.key === key);
  if (alreadyActive) return current;
  const card = { type: "stat" as const, key };
  const last = current[current.length - 1];
  const next = last?.type === "empty" ? [...current.slice(0, -1), card] : [...current, card];
  saveStatLayout(next);
  return normalizeStatLayout(next);
}

/** Which card keys are active in the saved layout (or the default layout, if nothing is saved yet). */
export function activeStatKeys(defaultLayout: StatGridLayoutItem[]): Set<string> {
  const current = loadStatLayout(defaultLayout);
  return new Set(current.filter((item): item is StatLayoutItem => item.type === "stat").map((item) => item.key));
}

/** Tilføjer en ny "Overskrift"-sektionsskilledeler øverst i det aktive layout. */
export function addHeaderToLayout(defaultLayout: StatGridLayoutItem[]): StatGridLayoutItem[] {
  const current = loadStatLayout(defaultLayout);
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}`;
  const next = [{ type: "header" as const, id, text: "Overskrift" }, ...current];
  saveStatLayout(next);
  return next;
}

/**
 * Tilføjer en ny, tom fold-ud-boks (accordion) øverst i det aktive layout.
 * Den åbnes fra start, så brugeren kan trække kort ind i den med det samme.
 */
export function addAccordionToLayout(defaultLayout: StatGridLayoutItem[], title: string): StatGridLayoutItem[] {
  const current = loadStatLayout(defaultLayout);
  const id = makeLayoutId();
  const next: StatGridLayoutItem[] = [
    { type: "accordion", id, title, open: true },
    { type: "accordionEnd", id },
    ...current,
  ];
  saveStatLayout(next);
  return normalizeStatLayout(next);
}

/** Tilføjer en ny visuel skillelinje (divider) øverst i det aktive layout. */
export function addDividerToLayout(defaultLayout: StatGridLayoutItem[]): StatGridLayoutItem[] {
  const current = loadStatLayout(defaultLayout);
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}`;
  const next = [{ type: "divider" as const, id }, ...current];
  saveStatLayout(next);
  return next;
}

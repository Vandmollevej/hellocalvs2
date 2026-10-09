// Tilføj-menuens felters rækkefølge og skjulte felter (AddMenuList.tsx),
// gemt pr. enhed ligesom bundmenuen (BottomNav) og forsidens knapper
// (add-actions.ts). Brugerens ønske 2026-10-07: hold fingeren inde for at
// omrokere og slette felter, "Tilføj" øverst til højre som i bunden og på
// statistik-siden.

export type AddMenuLayout = { order: string[]; hidden: string[] };

const STORAGE_KEY = "hellocal.addMenu.layout";

export function defaultAddMenuLayout(keys: readonly string[]): AddMenuLayout {
  return { order: [...keys], hidden: [] };
}

/** Retter en gemt rækkefølge til de felter, der findes nu (nye felter sidst). */
export function normalizeAddMenuLayout(layout: AddMenuLayout, keys: readonly string[]): AddMenuLayout {
  const known = new Set(keys);
  const hidden = layout.hidden.filter((key, i, all) => known.has(key) && all.indexOf(key) === i);
  const order = layout.order.filter((key, i, all) => known.has(key) && all.indexOf(key) === i);
  for (const key of keys) {
    if (!order.includes(key)) order.push(key);
  }
  return { order, hidden };
}

export function loadAddMenuLayout(keys: readonly string[]): AddMenuLayout {
  if (typeof window === "undefined") return defaultAddMenuLayout(keys);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAddMenuLayout(keys);
    const parsed = JSON.parse(raw) as Partial<AddMenuLayout>;
    return normalizeAddMenuLayout(
      {
        order: Array.isArray(parsed.order) ? parsed.order.filter((key): key is string => typeof key === "string") : [],
        hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((key): key is string => typeof key === "string") : [],
      },
      keys,
    );
  } catch {
    return defaultAddMenuLayout(keys);
  }
}

export function saveAddMenuLayout(layout: AddMenuLayout) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // localStorage utilgængeligt — ændringen gælder kun til siden lukkes.
  }
}

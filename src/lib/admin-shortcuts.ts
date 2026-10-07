// Tastaturgenveje i admin (docs/AUTOMATION.md). Ren logik uden React, så den
// kan testes med `npm test` og læses af både skallen og Genveje-siden.
//
// Regler:
//  - Alt + bogstav/ciffer = de hyppigste sider, Alt + Shift + bogstav = øvrige.
//  - Ctrl + P (Varer) er brugerens ønske; Ctrl + K (Gå til…) og Ctrl + B
//    (sidebjælken) er handlinger. Ellers bruges Ctrl ikke, så redigering
//    (Ctrl+A/C/V/X/Z) og faneskift i browseren aldrig forstyrres.
//  - Alt + D/E/F er sprunget over (browserens adresse- og menugenveje).
//  - AltGr (= Ctrl + Alt på Windows) og Cmd + Alt ignoreres, så tegn som @, €
//    og { } stadig kan skrives.
// Nøglen er sidens adresse i AdminShell's menu; en side uden genvej vises som
// "–" på Genveje-siden.

export type ShortcutAction = "quick-search" | "toggle-sidebar";

export type ShortcutTarget =
  | { kind: "page"; href: string }
  | { kind: "action"; action: ShortcutAction };

// Første genvej er den primære (vises i menuen); resten er ekstra.
export const ADMIN_PAGE_SHORTCUTS: Record<string, readonly string[]> = {
  "/admin": ["Alt+O"],
  "/admin/statistics": ["Alt+S"],
  "/admin/integrations": ["Alt+I"],
  "/admin/economy": ["Alt+Shift+E"],
  "/admin/hello-doc": ["Alt+H"],
  "/admin/log": ["Alt+L"],

  // Varegodkendelse
  "/admin/quality-control": ["Alt+K"],
  "/admin/uncertainties": ["Alt+U"],
  "/admin/duplicate-products": ["Alt+Shift+D"],
  "/admin/ingredient-requests": ["Alt+Shift+I"],
  "/admin/images": ["Alt+Shift+B"],
  "/admin/images/cutout-queue": ["Alt+Shift+C"],
  "/admin/products": ["Alt+N"],
  "/admin/logos": ["Alt+Shift+L"],

  // Varedatabase
  "/admin/product-database/products": ["Alt+P", "Ctrl+P"],
  "/admin/product-database/brands": ["Alt+Shift+R"],
  "/admin/product-database/images": ["Alt+Shift+X"],

  // Retter
  "/admin/dishes/user": ["Alt+Shift+U"],
  "/admin/dishes/hellofresh": ["Alt+Shift+H"],
  "/admin/dishes/valdemarsro": ["Alt+V"],

  // Flows
  "/admin/flows": ["Alt+Shift+W"],
  "/admin/guide-builder": ["Alt+Shift+G"],

  // Design og opbygning
  "/admin/designmanual": ["Alt+Shift+N"],
  "/admin/page-tree": ["Alt+Shift+T"],

  // Brugere
  "/admin/users": ["Alt+B"],
  "/admin/users/points": ["Alt+Shift+P"],
  "/admin/chatbot": ["Alt+C"],
  "/admin/users/personas": ["Alt+Shift+O"],
  "/admin/test-programmes": ["Alt+T"],
  "/admin/bug-reports": ["Alt+Shift+F"],
  "/admin/support": ["Alt+M"],

  // Indstillinger
  "/admin/api-keys": ["Alt+Shift+A"],
  "/admin/cron-jobs": ["Alt+Shift+J"],
  "/admin/passkeys": ["Alt+Shift+Y"],
  "/admin/support/templates": ["Alt+Shift+S"],
  "/admin/messaging": ["Alt+Shift+M"],
  "/admin/search-ranking": ["Alt+Shift+Q"],
  "/admin/shortcuts": ["Alt+G"],

  // Administration
  "/admin/scan-invites": ["Alt+Shift+V"],
  "/admin/jobs": ["Alt+J"],
  "/admin/agents": ["Alt+A"],
  "/admin/robots": ["Alt+R"],

  // Partnere og Roadmap: Alt + 1…6 i menuens rækkefølge
  "/admin/partners/ads": ["Alt+1"],
  "/admin/partners/contacts": ["Alt+2"],
  "/admin/partners/users": ["Alt+3"],
  "/admin/partners/reports": ["Alt+4"],
  "/admin/roadmap": ["Alt+5"],
  "/admin/claude": ["Alt+6"],

  // Brugermenuen (kun fuld adgang)
  "/admin/admin-users": ["Alt+W"],
};

export const ADMIN_ACTION_SHORTCUTS: readonly { action: ShortcutAction; combo: string }[] = [
  { action: "quick-search", combo: "Ctrl+K" },
  { action: "toggle-sidebar", combo: "Ctrl+B" },
];

const TARGETS = new Map<string, ShortcutTarget>();
for (const [href, combos] of Object.entries(ADMIN_PAGE_SHORTCUTS)) {
  for (const combo of combos) TARGETS.set(combo, { kind: "page", href });
}
for (const { action, combo } of ADMIN_ACTION_SHORTCUTS) TARGETS.set(combo, { kind: "action", action });

export type KeyEventLike = {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

// Tasteanslag → kanonisk streng ("Alt+Shift+E"), eller null hvis det ikke kan
// være en genvej. Cmd tæller som Ctrl. Tegnet læses fra event.key, når det er
// A–Z/0–9 (følger tastaturlayoutet); ellers fra event.code (Mac-Option og
// Shift+ciffer giver andre tegn i event.key).
export function eventToCombo(event: KeyEventLike): string | null {
  const ctrl = event.ctrlKey || event.metaKey;
  if (ctrl === event.altKey) {
    // Ingen modifikator (almindelig skrift), eller Ctrl+Alt (AltGr): ikke vores.
    return null;
  }
  let key: string | null = null;
  if (/^[a-z0-9]$/i.test(event.key)) key = event.key.toUpperCase();
  else {
    const code = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(event.code);
    if (code) key = code[1] ?? code[2];
  }
  if (!key) return null;
  return `${ctrl ? "Ctrl+" : "Alt+"}${event.shiftKey ? "Shift+" : ""}${key}`;
}

export function findShortcut(event: KeyEventLike): ShortcutTarget | null {
  const combo = eventToCombo(event);
  return combo ? (TARGETS.get(combo) ?? null) : null;
}

export function shortcutsForHref(href: string): readonly string[] {
  return ADMIN_PAGE_SHORTCUTS[href] ?? [];
}

// Til det lille tastaturmærke: "Alt+Shift+E" → "Alt + Shift + E".
export function formatCombo(combo: string): string {
  return combo.split("+").join(" + ");
}

// Til aria-keyshortcuts (Chrome/Edge viser den som UIA "AcceleratorKey"):
// ARIA kalder Ctrl for "Control".
export function ariaKeyShortcuts(combos: readonly string[]): string | undefined {
  if (combos.length === 0) return undefined;
  return combos.map((combo) => combo.replace(/^Ctrl\+/, "Control+")).join(" ");
}

// Til AutoHotkey Send: Ctrl = ^, Alt = !, Shift = +, tegnet med småt.
export function ahkSend(combo: string): string {
  const parts = combo.split("+");
  const key = parts[parts.length - 1].toLowerCase();
  const mods = parts.slice(0, -1).map((part) => (part === "Ctrl" ? "^" : part === "Alt" ? "!" : "+"));
  return `${mods.join("")}${key}`;
}

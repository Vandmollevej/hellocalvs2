// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ADMIN_ACTION_SHORTCUTS,
  ADMIN_PAGE_SHORTCUTS,
  ahkSend,
  ariaKeyShortcuts,
  eventToCombo,
  findShortcut,
  formatCombo,
} from "./admin-shortcuts.ts";
import { automationProps, navSlug, pageSlug, slugifyAutomation, uniqueName } from "./automation-markers.ts";

function press(key, mods = {}, code) {
  return {
    key,
    code: code ?? (/^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^[0-9]$/.test(key) ? `Digit${key}` : key),
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...mods,
  };
}

test("every shortcut is unique and written in canonical form", () => {
  const combos = [
    ...Object.values(ADMIN_PAGE_SHORTCUTS).flat(),
    ...ADMIN_ACTION_SHORTCUTS.map((entry) => entry.combo),
  ];
  const duplicates = combos.filter((combo, index) => combos.indexOf(combo) !== index);
  assert.deepEqual(duplicates, [], "samme genvej brugt to steder");
  for (const combo of combos) {
    assert.match(combo, /^(?:Ctrl\+|Alt\+(?:Shift\+)?)[A-Z0-9]$/, `${combo} er ikke kanonisk`);
  }
});

test("shortcuts never take editing, tab or browser-menu keys", () => {
  const forbidden = new Set([
    "Ctrl+A", "Ctrl+C", "Ctrl+V", "Ctrl+X", "Ctrl+Z", "Ctrl+Y", "Ctrl+N", "Ctrl+T", "Ctrl+W",
    "Alt+D", "Alt+E", "Alt+F",
  ]);
  const combos = [
    ...Object.values(ADMIN_PAGE_SHORTCUTS).flat(),
    ...ADMIN_ACTION_SHORTCUTS.map((entry) => entry.combo),
  ];
  assert.deepEqual(combos.filter((combo) => forbidden.has(combo)), []);
});

test("every page in the admin menu has a shortcut", () => {
  const source = readFileSync(fileURLToPath(new URL("../components/admin/AdminShell.tsx", import.meta.url)), "utf8");
  const nav = source.slice(source.indexOf("export const NAV"), source.indexOf("const OPEN_GROUPS_KEY"));
  const hrefs = [...nav.matchAll(/href: "(\/admin[^"]*)"/g)].map((match) => match[1]);
  assert.ok(hrefs.length > 40, "fandt ikke menuen i AdminShell.tsx");
  const missing = hrefs.filter((href) => !(ADMIN_PAGE_SHORTCUTS[href]?.length > 0));
  assert.deepEqual(missing, [], "tilføj en genvej i src/lib/admin-shortcuts.ts");
  const unknown = Object.keys(ADMIN_PAGE_SHORTCUTS).filter((href) => !hrefs.includes(href) && href !== "/admin/admin-users");
  assert.deepEqual(unknown, [], "genvej til en side, der ikke er i menuen");
});

test("Ctrl+P opens the product list", () => {
  assert.deepEqual(ADMIN_PAGE_SHORTCUTS["/admin/product-database/products"], ["Alt+P", "Ctrl+P"]);
  assert.deepEqual(findShortcut(press("p", { ctrlKey: true })), {
    kind: "page",
    href: "/admin/product-database/products",
  });
  assert.deepEqual(findShortcut(press("k", { ctrlKey: true })), { kind: "action", action: "quick-search" });
  assert.deepEqual(findShortcut(press("b", { metaKey: true })), { kind: "action", action: "toggle-sidebar" });
});

test("Alt and Alt+Shift pick different pages", () => {
  assert.deepEqual(findShortcut(press("o", { altKey: true })), { kind: "page", href: "/admin" });
  assert.deepEqual(findShortcut(press("E", { altKey: true, shiftKey: true })), { kind: "page", href: "/admin/economy" });
  assert.deepEqual(findShortcut(press("3", { altKey: true })), { kind: "page", href: "/admin/partners/users" });
});

test("plain typing, AltGr and unknown keys are ignored", () => {
  assert.equal(eventToCombo(press("p")), null);
  assert.equal(eventToCombo(press("P", { shiftKey: true })), null);
  // AltGr på dansk tastatur: Ctrl + Alt og tegnet @ / €
  assert.equal(eventToCombo(press("@", { ctrlKey: true, altKey: true }, "Digit2")), null);
  assert.equal(findShortcut(press("q", { ctrlKey: true })), null);
  assert.equal(findShortcut(press("Enter", { altKey: true })), null);
});

test("Mac Option gives special characters in event.key, so event.code is used", () => {
  assert.equal(eventToCombo(press("π", { altKey: true }, "KeyP")), "Alt+P");
  assert.equal(eventToCombo(press("¡", { altKey: true }, "Digit1")), "Alt+1");
  assert.equal(eventToCombo(press("!", { altKey: true, shiftKey: true }, "Digit1")), "Alt+Shift+1");
});

test("formatting helpers for menu, ARIA and AutoHotkey", () => {
  assert.equal(formatCombo("Alt+Shift+E"), "Alt + Shift + E");
  assert.equal(ariaKeyShortcuts(["Alt+P", "Ctrl+P"]), "Alt+P Control+P");
  assert.equal(ariaKeyShortcuts([]), undefined);
  assert.equal(ahkSend("Alt+O"), "!o");
  assert.equal(ahkSend("Alt+Shift+E"), "!+e");
  assert.equal(ahkSend("Ctrl+P"), "^p");
  assert.equal(ahkSend("Alt+1"), "!1");
});

test("automation names are stable ASCII slugs", () => {
  assert.equal(slugifyAutomation("Ønskede ingredienser"), "oenskede-ingredienser");
  assert.equal(slugifyAutomation("  Gem  &  luk! "), "gem-luk");
  assert.equal(slugifyAutomation("Café Åben"), "cafe-aaben");
  assert.equal(slugifyAutomation(""), "");
  assert.equal(slugifyAutomation("x".repeat(80)).length, 40);
  assert.equal(pageSlug("/admin"), "overview");
  assert.equal(pageSlug("/admin/product-database/products"), "product-database-products");
  assert.equal(navSlug("nav_product_database_products"), "product-database-products");
  assert.deepEqual(automationProps("hc-nav-log"), { id: "hc-nav-log", "data-automation": "hc-nav-log" });
});

test("uniqueName numbers repeated names", () => {
  const used = new Set(["button-gem"]);
  assert.equal(uniqueName("button-gem", used), "button-gem-2");
  assert.equal(uniqueName("button-gem", used), "button-gem-3");
  assert.equal(uniqueName("button-slet", used), "button-slet");
});

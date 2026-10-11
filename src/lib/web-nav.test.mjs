// Kør: npm test  (node --test)
//
// Webversionen (desktop-skallen, `src/components/web/WebShell.tsx`) skal kunne
// alt, hvad appen kan — undtagen det, der kræver kameraet (bruger 2026-10-11).
// Menuerne ligger i `src/lib/web-nav.ts`. Testen læser appens egne menuer
// (Profil, Indstillinger, Visning, bundmenuens ikoner) og fejler, når appen har
// fået et punkt, som webmenuen ikke dækker — så webben ikke igen sakker bagud.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");

// Rute uden query og anker: "/privatlivspolitik#datasporing" → "/privatlivspolitik".
const routeOf = (href) => href.split("#")[0].split("?")[0];

// Punkter appen har, men som webben bevidst ikke har — med begrundelse.
const NOT_ON_WEB = {
  "/": "Forsiden (drejehjul, dagens liste) findes ikke på desktop: kalenderens dagsvisning er forsiden",
  "/camera": "Kræver kameraet, som ikke findes på en computer",
  "/profile/photo-diary": "Billeddagbogen kræver kameraet (bruger 2026-10-11)",
  "/voice": "Mikrofonen er afløst af Chat (Indtast) på desktop",
};

// Alle ruter, webmenuen linker til.
const navSource = read("src/lib/web-nav.ts");
const navItems = [...navSource.matchAll(/href:\s*"([^"]+)",\s*labelKey:\s*"([^"]+)"/g)].map((match) => ({
  href: match[1],
  route: routeOf(match[1]),
  labelKey: match[2],
}));
// Kalenderen står i topmenuen som `href: WEB_HOME` (konstanten er desktop-forsiden).
const webHome = navSource.match(/export const WEB_HOME = "([^"]+)"/)?.[1];
assert.ok(webHome, "WEB_HOME mangler i web-nav.ts");
navItems.push({ href: webHome, route: routeOf(webHome), labelKey: "nav.calendar" });
const navRoutes = new Set(navItems.map((item) => item.route));

// Ruter i appens egne menuer (JSX `href="…"` og objekter `href: "…"`).
function menuRoutes(path) {
  return [...read(path).matchAll(/href\s*[=:]\s*\{?\s*["']([^"'{$]+)["']/g)]
    .map((match) => routeOf(match[1]))
    .filter((route) => route.startsWith("/"));
}

function bottomNavRoutes() {
  const block = read("src/lib/navigation.ts").match(/BOTTOM_NAV_HREFS[^{]*\{([^}]*)\}/)?.[1] ?? "";
  return [...block.matchAll(/:\s*"([^"]+)"/g)].map((match) => routeOf(match[1]));
}

const APP_MENUS = {
  "Profil-siden (src/app/profile/page.tsx)": menuRoutes("src/app/profile/page.tsx"),
  "Indstillinger (src/app/settings/page.tsx)": menuRoutes("src/app/settings/page.tsx"),
  "Indstillinger → Visning (src/app/settings/display/page.tsx)": menuRoutes("src/app/settings/display/page.tsx"),
  "Bundmenuens ikoner (src/lib/navigation.ts)": bottomNavRoutes(),
};

test("appens menuer kunne læses (regexene er ikke gået i stykker)", () => {
  for (const [name, routes] of Object.entries(APP_MENUS)) {
    assert.ok(routes.length >= 4, `${name}: fandt kun ${routes.length} ruter`);
  }
  assert.ok(navItems.length >= 30, `web-nav.ts: fandt kun ${navItems.length} punkter`);
});

test("hvert punkt i appens menuer findes i webmenuen (eller er begrundet udeladt)", () => {
  const missing = [];
  for (const [name, routes] of Object.entries(APP_MENUS)) {
    for (const route of new Set(routes)) {
      if (navRoutes.has(route) || NOT_ON_WEB[route]) continue;
      missing.push(`${route}  (${name})`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `Appen har menupunkter, som webversionen mangler. Føj dem til src/lib/web-nav.ts (eller til NOT_ON_WEB i denne test med en begrundelse):\n${missing.join("\n")}`,
  );
});

test("tilføj-menuen (plus-cirklen) udelader kun mikrofon og kamera", () => {
  // Plus-cirklen viser appens egen tilføj-menu (AddMenuList); kun felter, der
  // kræver mikrofon (voice) eller kamera (scan, platePhoto), udelades.
  const shell = read("src/components/web/WebShell.tsx");
  const excluded = shell.match(/<AddMenuList[^>]*excludeKeys=\{\[([^\]]*)\]\}/)?.[1];
  assert.ok(excluded !== undefined, "WebShell skal bygge plus-menuen af AddMenuList");
  const keys = [...excluded.matchAll(/"(\w+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(keys, ["platePhoto", "scan", "voice"]);
});

test("forsidens popups (vægt/tøj, synk, pulsudsving) vises i webversionen", () => {
  // Popups, der kun er monteret på appens forside, findes ikke på desktop, fordi
  // roden sender videre til kalenderen. Ethvert `<…Prompt(s) />` på forsiden
  // skal derfor også monteres af WebStartPrompts (som AppFrame sætter i skallen).
  const home = read("src/app/page.tsx");
  const startPrompts = read("src/components/web/WebStartPrompts.tsx");
  const frame = read("src/components/AppFrame.tsx");
  const prompts = [...home.matchAll(/<(\w*Prompts?)\b[^>]*\/>/g)].map((match) => match[1]);
  assert.ok(prompts.length >= 2, "forsiden viser ikke længere popups — opdatér testen");
  for (const prompt of prompts) {
    assert.match(
      startPrompts,
      new RegExp(`<${prompt}\\b`),
      `${prompt} sidder på appens forside, men desktop sender videre til kalenderen — monter den i WebStartPrompts`,
    );
  }
  assert.match(frame, /<WebShell[^>]*overlays=\{<WebStartPrompts \/>\}/, "AppFrame skal sætte WebStartPrompts i WebShell");
});

test("alle webmenuens punkter har tekst og en side", () => {
  const da = JSON.parse(read("src/i18n/locales/da.json"));
  const lookup = (key) => key.split(".").reduce((node, part) => node?.[part], da);
  for (const item of navItems) {
    assert.equal(typeof lookup(item.labelKey), "string", `tekstnøglen ${item.labelKey} findes ikke i da.json`);
    const exists =
      item.route === "/"
        ? existsSync(`${root}src/app/page.tsx`)
        : existsSync(`${root}src/app${item.route}/page.tsx`) || existsSync(`${root}public${item.route}`);
    assert.ok(exists, `${item.href} peger på en side, der ikke findes`);
  }
});

test("webmenuen peger aldrig på kameraet", () => {
  for (const route of ["/camera", "/profile/photo-diary", "/voice"]) {
    assert.ok(!navRoutes.has(route), `${route} kan ikke bruges på en computer`);
  }
});

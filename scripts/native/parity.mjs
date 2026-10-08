#!/usr/bin/env node
// Web ↔ native parity guard.
//
// Every user-facing web page has a row in native/parity/screens.json that says
// which native screen (Compose Multiplatform, shared by Android and iPhone)
// mirrors it. When a screen is ported, the hashes of the web files it is built
// from (the page plus every component it imports, recursively) are recorded in
// native/parity/accepted.json. If any of those web files changes later, this
// script reports the native screen as out of date until the change has been
// carried over and accepted again.
//
//   node scripts/native/parity.mjs                 report; exit 1 on drift/unregistered pages
//   node scripts/native/parity.mjs --accept /calendar [/search …]
//   node scripts/native/parity.mjs --accept-all    accept every ported screen as-is
//   node scripts/native/parity.mjs --register      add new web pages as "pending" rows
//   node scripts/native/parity.mjs --hook          Claude Code Stop hook (see .claude/settings.json)
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCREENS_FILE = join(ROOT, "native", "parity", "screens.json");
const ACCEPTED_FILE = join(ROOT, "native", "parity", "accepted.json");
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".css"];
// Only UI code is tracked. src/lib is business logic that the native app gets
// through the same /api routes, so a change there needs no native port.
const TRACKED_PREFIXES = ["src/app/", "src/components/"];
const EXCLUDED_PREFIXES = ["src/app/api/"];

const posix = (p) => p.split(sep).join("/");
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback);
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
// Line endings normalised, so Windows checkouts and CI agree.
const sha1 = (file) =>
  createHash("sha1").update(readFileSync(join(ROOT, file), "utf8").replace(/\r\n/g, "\n")).digest("hex").slice(0, 16);

function isTracked(file) {
  return TRACKED_PREFIXES.some((p) => file.startsWith(p)) && !EXCLUDED_PREFIXES.some((p) => file.startsWith(p));
}

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(join(ROOT, dirname(fromFile)), spec);
  else return null;
  const candidates = [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => join(base, `index${e}`))];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return posix(relative(ROOT, c));
  }
  return null;
}

const IMPORT_RE = /(?:import|export)\s[^"'`]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

/** The page file plus every tracked file it imports, recursively. */
function closure(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file) || !existsSync(join(ROOT, file))) continue;
    seen.add(file);
    const source = readFileSync(join(ROOT, file), "utf8");
    for (const m of source.matchAll(IMPORT_RE)) {
      const target = resolveImport(file, m[1] ?? m[2] ?? m[3]);
      if (target && isTracked(target) && !seen.has(target)) stack.push(target);
    }
  }
  // Layouts wrap the page and are part of what the user sees.
  let dir = dirname(entry);
  while (dir.startsWith("src/app")) {
    for (const name of ["layout.tsx", "template.tsx"]) {
      const f = `${dir}/${name}`;
      if (existsSync(join(ROOT, f)) && !seen.has(f)) seen.add(f);
    }
    dir = dirname(dir);
  }
  return [...seen].filter(isTracked).sort();
}

function hashes(entry) {
  return Object.fromEntries(closure(entry).map((f) => [f, sha1(f)]));
}

/** Every page.tsx under src/app as its web route ("/profile/goals/[id]"). */
function webPages() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(ROOT, rel)).isDirectory()) {
        if (rel !== "src/app/api") walk(rel);
      } else if (name === "page.tsx") {
        const route =
          "/" +
          rel
            .replace(/^src\/app\/?/, "")
            .replace(/\/?page\.tsx$/, "")
            .split("/")
            .filter((s) => s && !/^\(.*\)$/.test(s))
            .join("/");
        out.push({ route: route === "/" ? "/" : route.replace(/\/$/, ""), web: rel });
      }
    }
  };
  walk("src/app");
  return out.sort((a, b) => a.route.localeCompare(b.route));
}

function analyse() {
  const manifest = readJson(SCREENS_FILE, { screens: [] });
  const accepted = readJson(ACCEPTED_FILE, {});
  const known = new Set(manifest.screens.map((s) => s.route));
  const unregistered = webPages().filter((p) => !known.has(p.route));
  const drift = [];
  const removed = [];
  for (const screen of manifest.screens) {
    if (!existsSync(join(ROOT, screen.web))) {
      removed.push(screen);
      continue;
    }
    if (screen.status !== "ported") continue;
    const before = accepted[screen.route] ?? {};
    const now = hashes(screen.web);
    const changed = Object.keys(now).filter((f) => before[f] !== now[f]);
    const gone = Object.keys(before).filter((f) => !(f in now));
    if (changed.length || gone.length) drift.push({ screen, changed: [...changed, ...gone] });
  }
  return { manifest, accepted, unregistered, drift, removed };
}

function changedInThisBranch() {
  try {
    const run = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const files = new Set();
    for (const line of run("git status --porcelain").split("\n")) if (line.trim()) files.add(line.slice(3).trim().replace(/^"|"$/g, ""));
    try {
      for (const f of run("git diff --name-only origin/master...HEAD").split("\n")) if (f.trim()) files.add(f.trim());
    } catch {
      /* no origin/master locally */
    }
    return files;
  } catch {
    return null;
  }
}

function describe(d) {
  return `  ${d.screen.route}  →  ${d.screen.native.join(", ")}\n${d.changed.map((f) => `      ændret: ${f}`).join("\n")}`;
}

const args = process.argv.slice(2);
const mode = args[0] ?? "--report";

if (mode === "--register") {
  const { manifest, unregistered } = analyse();
  for (const p of unregistered) manifest.screens.push({ route: p.route, web: p.web, status: "pending", native: [] });
  manifest.screens.sort((a, b) => a.route.localeCompare(b.route));
  writeJson(SCREENS_FILE, manifest);
  console.log(`Registrerede ${unregistered.length} nye web-sider som "pending".`);
} else if (mode === "--port") {
  // --port /calendar native/shared/.../CalendarScreen.kt[,more.kt]  → status "ported" + accept
  const [route, files] = args.slice(1);
  const { manifest, accepted } = analyse();
  const screen = manifest.screens.find((s) => s.route === route);
  if (!screen) throw new Error(`Ukendt rute: ${route}`);
  screen.status = "ported";
  screen.native = files.split(",");
  delete screen.note;
  accepted[route] = hashes(screen.web);
  writeJson(SCREENS_FILE, manifest);
  writeJson(ACCEPTED_FILE, Object.fromEntries(Object.entries(accepted).sort(([a], [b]) => a.localeCompare(b))));
  console.log(`Porteret og godkendt: ${route}`);
} else if (mode === "--accept" || mode === "--accept-all") {
  const { manifest, accepted } = analyse();
  const routes = mode === "--accept-all" ? manifest.screens.filter((s) => s.status === "ported").map((s) => s.route) : args.slice(1);
  for (const route of routes) {
    const screen = manifest.screens.find((s) => s.route === route);
    if (!screen) throw new Error(`Ukendt rute: ${route}`);
    if (screen.status !== "ported") throw new Error(`${route} er ikke markeret "ported" i screens.json`);
    accepted[route] = hashes(screen.web);
  }
  writeJson(ACCEPTED_FILE, Object.fromEntries(Object.entries(accepted).sort(([a], [b]) => a.localeCompare(b))));
  console.log(`Godkendt: ${routes.join(", ") || "(ingen)"}`);
} else if (mode === "--hook") {
  // Claude Code Stop hook: block the session from finishing while web UI it
  // changed has not been carried over to the native screens.
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    /* no stdin */
  }
  if (input.stop_hook_active) process.exit(0);
  // Sessions often work in their own git worktree: check the tree the session is in.
  if (input.cwd) {
    try {
      const top = execSync("git rev-parse --show-toplevel", { cwd: input.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      const other = join(top, "scripts", "native", "parity.mjs");
      if (resolve(top) !== resolve(ROOT) && existsSync(other)) {
        const out = execSync(`node "${other}" --hook`, { input: JSON.stringify({ ...input, cwd: undefined }), encoding: "utf8" });
        process.stdout.write(out);
        process.exit(0);
      }
    } catch {
      /* not a git tree — fall through */
    }
  }
  const mine = changedInThisBranch();
  if (!mine || ![...mine].some(isTracked)) process.exit(0);
  const { drift, unregistered } = analyse();
  const myDrift = drift.filter((d) => d.changed.some((f) => mine.has(f)));
  const myNew = unregistered.filter((p) => mine.has(p.web));
  let syncStale = false;
  try {
    execSync("node scripts/native/sync.mjs --check", { cwd: ROOT, stdio: "ignore" });
  } catch {
    syncStale = true;
  }
  if (!myDrift.length && !myNew.length && !syncStale) process.exit(0);
  const lines = ["Web-UI er ændret, men den native app (Android + iPhone) er ikke fulgt med:"];
  if (myDrift.length) lines.push(...myDrift.map(describe), "Overfør ændringen til de native skærme, og kør derefter `node scripts/native/parity.mjs --accept <rute>`.");
  if (myNew.length) lines.push(`Nye web-sider uden native række: ${myNew.map((p) => p.route).join(", ")} — kør \`node scripts/native/parity.mjs --register\`.`);
  if (syncStale) lines.push("Farver/tekster er ændret på web — kør `node scripts/native/sync.mjs` og commit de genererede filer.");
  lines.push("Se native/README.md (afsnittet 'Hold web og native i takt').");
  process.stdout.write(JSON.stringify({ decision: "block", reason: lines.join("\n") }));
  process.exit(0);
} else {
  const { manifest, unregistered, drift, removed } = analyse();
  const count = (st) => manifest.screens.filter((s) => s.status === st).length;
  console.log(`Native-paritet: ${count("ported")} porteret, ${count("pending")} mangler, ${count("web-only")} kun web.`);
  if (drift.length) console.log(`\nNative skærme bagud i forhold til web (${drift.length}):\n${drift.map(describe).join("\n")}`);
  if (unregistered.length) console.log(`\nWeb-sider uden række i screens.json (${unregistered.length}):\n${unregistered.map((p) => `  ${p.route}`).join("\n")}`);
  if (removed.length) console.log(`\nRækker hvis web-side er slettet (${removed.length}):\n${removed.map((s) => `  ${s.route}`).join("\n")}`);
  process.exit(drift.length || unregistered.length || removed.length ? 1 : 0);
}

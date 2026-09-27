// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { flattenPageTree } from "./page-tree.ts";

const APP_DIR = fileURLToPath(new URL("../app", import.meta.url));

function routesOnDisk(dir) {
  const routes = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "api") continue;
      routes.push(...routesOnDisk(full));
    } else if (entry.name === "page.tsx") {
      const rel = relative(APP_DIR, dir).split(sep).filter((part) => !/^\(.*\)$/.test(part)).join("/");
      routes.push(`/${rel}`);
    }
  }
  return routes;
}

test("page tree lists every page in src/app exactly once", () => {
  const listed = flattenPageTree().map((node) => node.path);
  const duplicates = listed.filter((path, index) => listed.indexOf(path) !== index);
  assert.deepEqual(duplicates, [], "sider nævnt mere end én gang");

  const onDisk = routesOnDisk(APP_DIR).sort();
  const missing = onDisk.filter((path) => !listed.includes(path));
  const unknown = listed.filter((path) => !onDisk.includes(path));
  assert.deepEqual(missing, [], "sider der mangler i src/lib/page-tree.ts");
  assert.deepEqual(unknown, [], "sider i page-tree.ts der ikke findes");
});

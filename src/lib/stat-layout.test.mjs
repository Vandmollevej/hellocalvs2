// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { accordionAt, accordionRange, normalizeStatLayout } from "./stat-layout.ts";

const stat = (key) => ({ type: "stat", key });
const acc = (id, open = true) => ({ type: "accordion", id, title: id, open });
const end = (id) => ({ type: "accordionEnd", id });

test("fold-ud-boks: rækker inde i boksen fyldes op til hele rækker", () => {
  const next = normalizeStatLayout([acc("a"), stat("x"), end("a"), stat("y")]);
  assert.deepEqual(
    next.map((item) => item.type),
    ["accordion", "stat", "empty", "accordionEnd", "stat", "empty"],
  );
  assert.deepEqual(accordionRange(next, "a"), { start: 0, end: 3 });
  assert.equal(accordionAt(next, 1), "a");
  assert.equal(accordionAt(next, 4), null);
});

test("fold-ud-boks: manglende slut-markør tilføjes, løse slut-markører fjernes", () => {
  const next = normalizeStatLayout([end("ghost"), acc("a"), stat("x"), stat("y")]);
  assert.deepEqual(
    next.map((item) => item.type),
    ["accordion", "stat", "stat", "accordionEnd"],
  );
});

test("fold-ud-boks: ingen indlejring — en ny boks lukker den forrige", () => {
  const next = normalizeStatLayout([acc("a"), stat("x"), acc("b"), stat("y"), end("b"), end("a")]);
  assert.deepEqual(
    next.map((item) => `${item.type}${"id" in item ? ":" + item.id : ""}`),
    ["accordion:a", "stat", "empty:pad-2", "accordionEnd:a", "accordion:b", "stat", "empty:pad-6", "accordionEnd:b"],
  );
});

test("fold-ud-boks: tomme rækker lige før slut-markøren fjernes, men ikke midt i", () => {
  const e = (id) => ({ type: "empty", id });
  const next = normalizeStatLayout([acc("a"), e("1"), e("2"), stat("x"), e("3"), e("4"), e("5"), end("a")]);
  assert.deepEqual(
    next.map((item) => item.type),
    ["accordion", "empty", "empty", "stat", "empty", "accordionEnd"],
  );
});

// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPEN_FLOW_STALE_MS, summarizeFlows } from "./debug-log-view.ts";

let next = 0;
function row(flowId, event, at, extra = {}) {
  next += 1;
  return {
    id: `r${next}`,
    createdAt: new Date(at),
    category: "scan",
    event,
    level: "info",
    flowId,
    userId: "u1",
    barcode: null,
    productId: null,
    durationMs: null,
    message: event,
    data: null,
    ...extra,
  };
}

test("afbrudt oprettelse med trin og fotos", () => {
  const [flow] = summarizeFlows([
    row("f1", "flow_start", 1000),
    row("f1", "barcode_photo_saved", 2000, { barcode: "5701234567890", data: { imageUrl: "/product-images/qc-uploads/a.jpg" } }),
    row("f1", "flow_photo", 3000, { data: { step: "front", imageUrl: "/product-images/scan-log/b.jpg" } }),
    row("f1", "flow_abandoned", 4000, { level: "warn", data: { step: "nutrition", how: "left" } }),
  ], 5000);
  assert.equal(flow.outcome, "abandoned");
  assert.equal(flow.creationStarted, true);
  assert.equal(flow.abandonedStep, "nutrition");
  assert.equal(flow.abandonedSilently, false);
  assert.deepEqual(flow.photos.map((photo) => photo.step), ["barcode", "front"]);
});

test("afbrudt på stregkoden er ikke en oprettelse", () => {
  const [flow] = summarizeFlows([
    row("f2", "flow_start", 1000),
    row("f2", "flow_abandoned", 2000, { data: { step: "barcode" } }),
  ], 3000);
  assert.equal(flow.outcome, "abandoned");
  assert.equal(flow.creationStarted, false);
});

test("stille flow uden afslutning regnes som afbrudt", () => {
  const rows = [row("f3", "flow_start", 0), row("f3", "front_photo", 1000)];
  assert.equal(summarizeFlows(rows, 1000 + OPEN_FLOW_STALE_MS - 1)[0].outcome, "open");
  const [flow] = summarizeFlows(rows, 1000 + OPEN_FLOW_STALE_MS + 1);
  assert.equal(flow.outcome, "abandoned");
  assert.equal(flow.abandonedSilently, true);
  assert.equal(flow.creationStarted, true);
});

test("genoptaget flow, der blev færdigt, er ikke afbrudt", () => {
  const [flow] = summarizeFlows([
    row("f4", "flow_start", 0),
    row("f4", "flow_abandoned", 1000, { data: { step: "front", how: "closed" } }),
    row("f4", "flow_done", 2000, { data: { outcome: "created" } }),
  ], 3000);
  assert.equal(flow.outcome, "created");
  assert.equal(flow.abandonedStep, null);
});

test("fotos uden sikker sti vises ikke", () => {
  const [flow] = summarizeFlows([
    row("f5", "flow_photo", 0, { data: { step: "front", imageUrl: "https://evil.example/x.jpg" } }),
  ], 1);
  assert.equal(flow.photos.length, 0);
});

// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PHOTOS_PER_PRODUCT, mergeSourcedLabels, pickSources } from "./product-label-sources.ts";

const a = (id, kind, step = null) => ({ id, kind, imageUrl: `/qc/${id}.jpg`, prediction: step ? { step } : {} });

test("mærkat-jobbet læser forside, helbilleder og stregkodefoto — ikke de beskårne trin med helbillede", () => {
  const sources = pickSources({
    imageUrl: "/product.png",
    pendingImageUrl: null,
    aiAnalyses: [a("f", "FRONT"), a("p1", "PACKAGE", "nutrition"), a("b", "BARCODE"), a("n", "NUTRITION"), a("i", "INGREDIENTS")],
  });
  assert.deepEqual(sources.map((s) => [s.analysisId, s.side]), [["f", "front"], ["p1", "other"], ["b", "other"], ["i", "other"]]);
});

test("uden kamerafotos bruges varens billede, og antallet af fotos er begrænset", () => {
  assert.deepEqual(pickSources({ imageUrl: "/product.png", pendingImageUrl: null, aiAnalyses: [] }), [
    { url: "/product.png", analysisId: null, side: "front" },
  ]);
  const many = Array.from({ length: 9 }, (_, i) => a(`p${i}`, "PACKAGE", "ingredients"));
  assert.equal(pickSources({ imageUrl: null, pendingImageUrl: null, aiAnalyses: many }).length, MAX_PHOTOS_PER_PRODUCT);
});

test("samme mærke på flere fotos: det sikreste fund vinder, boks foretrækkes", () => {
  const label = (key, confidence, sourceUrl, box = null) => ({ key, name: key, text: null, category: "ORGANIC", box, confidence, sourceUrl, analysisId: null });
  const box = { x: 0.1, y: 0.1, width: 0.1, height: 0.1 };
  const merged = mergeSourcedLabels([label("organic-eu", 0.8, "/front"), label("organic-eu", 0.95, "/back"), label("keyhole", 0.9, "/a"), label("keyhole", 0.9, "/b", box)]);
  assert.deepEqual(merged.map((l) => [l.key, l.sourceUrl]), [["organic-eu", "/back"], ["keyhole", "/b"]]);
});

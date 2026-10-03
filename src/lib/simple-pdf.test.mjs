// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimplePdf } from "./simple-pdf.ts";

test("PDF har header, én side og gyldig xref-start", () => {
  const pdf = new SimplePdf();
  pdf.heading("Rapport æøå");
  pdf.table([{ label: "Navn", width: 200 }, { label: "Tal", width: 100, align: "right" }], [["Skyr (test)", "12"]]);
  const buf = pdf.build();
  const text = buf.toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  assert.match(text, /\/Count 1/);
  const startxref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(startxref, startxref + 4), "xref");
  assert.ok(text.includes("Skyr \\(test\\)"));
});

test("mange rækker giver flere sider", () => {
  const pdf = new SimplePdf();
  pdf.table([{ label: "A", width: 100 }], Array.from({ length: 200 }, (_, i) => [`række ${i}`]));
  const text = pdf.build().toString("latin1");
  const count = Number(text.match(/\/Count (\d+)/)[1]);
  assert.ok(count >= 3);
});

// Kør: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { imageThumb } from "./image-thumb.ts";

test("egne billeder går gennem /_next/image", () => {
  assert.equal(
    imageThumb("/product-images/cutouts/a b.png", 128),
    "/_next/image?url=%2Fproduct-images%2Fcutouts%2Fa%20b.png&w=128&q=75",
  );
  assert.equal(imageThumb("/brand-logos/Taffel.JPG", 384), "/_next/image?url=%2Fbrand-logos%2FTaffel.JPG&w=384&q=75");
});

test("alt andet vises uændret", () => {
  for (const src of [
    null,
    undefined,
    "",
    "data:image/png;base64,AAAA",
    "blob:https://hellocal.io/1",
    "https://images.openfoodfacts.org/x.jpg",
    "//cdn.example.com/x.png",
    "/icons/x.svg",
    "/anim.gif",
    "/product-images/x.png?v=2",
    "/api/support/attachments/1",
  ]) {
    assert.equal(imageThumb(src, 128), src);
  }
});

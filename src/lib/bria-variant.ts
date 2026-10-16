import { existsSync } from "node:fs";
import path from "node:path";

// Bria-udgaven af et fritlagt varebillede (docs/BRIA.md): billedrobotten lægger
// {job}_bria.png ved siden af rembg-udklippet {job}.png, så admin kan sammenligne
// under Billedforslag og vælge den. Findes filen ikke, er der ingen Bria-udgave.
const CUTOUT_URL = /^\/product-images\/cutouts\/[0-9A-Za-z_-]+\.png$/;

export function briaVariantUrl(pendingImageUrl: string | null | undefined): string | null {
  if (!pendingImageUrl || !CUTOUT_URL.test(pendingImageUrl) || pendingImageUrl.endsWith("_bria.png")) return null;
  const url = pendingImageUrl.replace(/\.png$/, "_bria.png");
  return existsSync(path.join(process.cwd(), "public", url)) ? url : null;
}

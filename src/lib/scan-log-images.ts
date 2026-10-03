import { randomUUID } from "crypto";
import { mkdir, readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { stripImageMetadata } from "@/lib/image-metadata";

// Admin "Log" (docs/DECISIONS.md 2026-10-03): forside-, energi- og
// indholdsfotoet fra kameraflowet gemmes, så snart det er taget — ellers
// forsvinder de med en afbrudt oprettelse (de lå kun i telefonens hukommelse).
// Samme volumen som de øvrige fotos; slettes sammen med loggen efter 30 dage.
const OUTPUT_DIR = path.join(process.cwd(), "public", "product-images", "scan-log");
const PUBLIC_PREFIX = "/product-images/scan-log";
const FILE_PATTERN = /^[0-9a-f-]{36}\.jpg$/i;

export async function saveScanLogImage(dataUrl: string): Promise<string | null> {
  const match = /^data:image\/jpe?g;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  // docs/PRIVACY.md: gemte billeder må ikke bære EXIF/GPS.
  const buffer = stripImageMetadata(Buffer.from(match[1], "base64"), "image/jpeg");
  await mkdir(OUTPUT_DIR, { recursive: true });
  const filename = `${randomUUID()}.jpg`;
  await writeFile(path.join(OUTPUT_DIR, filename), buffer);
  return `${PUBLIC_PREFIX}/${filename}`;
}

export async function pruneScanLogImages(cutoff: Date): Promise<void> {
  const names = await readdir(OUTPUT_DIR).catch(() => [] as string[]);
  for (const name of names) {
    if (!FILE_PATTERN.test(name)) continue;
    const file = path.join(OUTPUT_DIR, name);
    const info = await stat(file).catch(() => null);
    if (info && info.mtime < cutoff) await unlink(file).catch(() => {});
  }
}

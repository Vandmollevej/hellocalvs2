import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { stripImageMetadata } from "@/lib/image-metadata";

// Partnerbannere (docs/DECISIONS.md 2026-10-02). Gemmes i den eksisterende
// /product-images-volume (compose.production.yaml) uden metadata, ligesom
// retbilleder. Filtypen afgøres af filens egne bytes, ikke af navn eller
// klientens oplysninger.
const OUTPUT_DIR = path.join(process.cwd(), "public", "product-images", "ad-banners");
const PUBLIC_PREFIX = "/product-images/ad-banners";
export const MAX_BANNER_BYTES = 4 * 1024 * 1024;

export const isAdBannerPath = (value: string) => /^\/product-images\/ad-banners\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(value);

export function sniffImageType(buffer: Buffer): { ext: "png" | "jpg" | "webp"; mime: string } | null {
  if (buffer.length > 12 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buffer.length > 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

export async function storeAdBanner(buffer: Buffer): Promise<{ url: string } | { error: string }> {
  if (buffer.length === 0) return { error: "Filen er tom" };
  if (buffer.length > MAX_BANNER_BYTES) return { error: "Billedet er for stort (højst 4 MB)" };
  const type = sniffImageType(buffer);
  if (!type) return { error: "Kun PNG, JPG og WebP kan bruges" };
  await mkdir(OUTPUT_DIR, { recursive: true });
  const filename = `${randomUUID()}.${type.ext}`;
  await writeFile(path.join(OUTPUT_DIR, filename), stripImageMetadata(buffer, type.mime));
  return { url: `${PUBLIC_PREFIX}/${filename}` };
}

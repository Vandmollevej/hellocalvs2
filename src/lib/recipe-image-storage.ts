import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { stripImageMetadata } from "@/lib/image-metadata";

// Billeder af egne retter og deres trin (docs/DECISIONS.md 2026-09-25).
// Gemmes i den eksisterende /product-images-volume (compose.production.yaml)
// uden EXIF/GPS (docs/PRIVACY.md), ligesom src/lib/qc-image-storage.ts.
const OUTPUT_DIR = path.join(process.cwd(), "public", "product-images", "recipe-images");
const PUBLIC_PREFIX = "/product-images/recipe-images";
const MAX_BYTES = 6 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = { png: "png", jpeg: "jpg", jpg: "jpg", webp: "webp" };

export function isRecipeImagePath(value: string) {
  return /^\/product-images\/recipe-images\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(value);
}

// Et billede fra klienten er enten en allerede gemt sti eller en data-URL.
export async function storeRecipeImage(value: unknown): Promise<string | null> {
  if (typeof value !== "string") return null;
  if (isRecipeImagePath(value)) return value;
  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(value.trim());
  if (!match) return null;
  const type = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;
  const mime = type === "jpg" ? "image/jpeg" : `image/${type}`;
  await mkdir(OUTPUT_DIR, { recursive: true });
  const filename = `${randomUUID()}.${EXTENSION_BY_MIME[type]}`;
  await writeFile(path.join(OUTPUT_DIR, filename), stripImageMetadata(buffer, mime));
  return `${PUBLIC_PREFIX}/${filename}`;
}

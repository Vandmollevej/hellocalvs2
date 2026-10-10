import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { stripImageMetadata } from "@/lib/image-metadata";
import { BUG_REPORT_SECTIONS, type BugReportPhotos, type BugReportSectionKey } from "@/lib/bug-report-sections";

// Fotos i "Indberet fejl" (docs/DECISIONS.md 2026-10-10): ét foto pr. sektion,
// taget med kameraet i sektionens bundark. Gemmes i den eksisterende
// /product-images-volume uden EXIF/GPS (docs/PRIVACY.md), ligesom
// src/lib/recipe-image-storage.ts.
const OUTPUT_DIR = path.join(process.cwd(), "public", "product-images", "bug-report-images");
const PUBLIC_PREFIX = "/product-images/bug-report-images";
const MAX_BYTES = 6 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = { png: "png", jpeg: "jpg", jpg: "jpg", webp: "webp" };

export function isBugReportImagePath(value: string) {
  return /^\/product-images\/bug-report-images\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(value);
}

// Et billede fra klienten er enten en allerede gemt sti eller en data-URL.
async function storeBugReportImage(value: unknown): Promise<string | null> {
  if (typeof value !== "string") return null;
  if (isBugReportImagePath(value)) return value;
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

/** Gemmer klientens sektionsfotos; ukendte nøgler og ugyldige billeder springes over. Null når intet er tilbage. */
export async function storeSectionPhotos(value: unknown): Promise<BugReportPhotos | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: BugReportPhotos = {};
  for (const { key } of BUG_REPORT_SECTIONS) {
    const stored = await storeBugReportImage((value as Record<string, unknown>)[key]);
    if (stored) result[key as BugReportSectionKey] = stored;
  }
  return Object.keys(result).length > 0 ? result : null;
}

import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { stripImageMetadata } from "@/lib/image-metadata";

// Kvalitetskontrol/billed-match (docs/DECISIONS.md 2026-09-19): de guidede
// stregkode-/næring-/ingrediens-fotos blev tidligere kun sendt transient til
// OpenAI Vision og aldrig gemt — se AiProductAnalysis-kommentaren i
// prisma/schema.prisma. Denne funktion gemmer dem i den allerede eksisterende
// /product-images-volume (compose.production.yaml), så den lokale
// billedanalyse-agent (scripts/quality-control-agent) kan læse dem fra disk.
const OUTPUT_DIR = path.join(process.cwd(), "public", "product-images", "qc-uploads");
export const QC_UPLOADS_PUBLIC_PREFIX = "/product-images/qc-uploads";

const EXTENSION_BY_MIME: Record<string, string> = {
  png: "png",
  jpeg: "jpg",
  jpg: "jpg",
  webp: "webp",
};

const MIME_BY_EXTENSION: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

// Læser et foto gemt af saveDataUrlImage tilbage som data-URL (fx til et
// senere AI-kald). Kun filer i qc-uploads; null hvis stien ikke passer.
export async function readStoredImageAsDataUrl(publicUrl: string): Promise<string | null> {
  const match = /^\/product-images\/qc-uploads\/([0-9a-f-]{36})\.(png|jpg|webp)$/i.exec(publicUrl);
  if (!match) return null;
  const buffer = await readFile(path.join(OUTPUT_DIR, `${match[1]}.${match[2]}`)).catch(() => null);
  if (!buffer) return null;
  return `data:${MIME_BY_EXTENSION[match[2].toLowerCase()]};base64,${buffer.toString("base64")}`;
}

export async function saveDataUrlImage(dataUrl: string): Promise<string | null> {
  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;

  const extension = EXTENSION_BY_MIME[match[1].toLowerCase()];
  if (!extension) return null;

  // docs/PRIVACY.md: gemte billeder må ikke bære EXIF/GPS.
  const mime = match[1].toLowerCase() === "jpg" ? "image/jpeg" : `image/${match[1].toLowerCase()}`;
  const buffer = stripImageMetadata(Buffer.from(match[2], "base64"), mime);
  await mkdir(OUTPUT_DIR, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(OUTPUT_DIR, filename), buffer);
  return `${QC_UPLOADS_PUBLIC_PREFIX}/${filename}`;
}

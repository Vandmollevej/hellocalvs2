import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

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

export async function saveDataUrlImage(dataUrl: string): Promise<string | null> {
  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;

  const extension = EXTENSION_BY_MIME[match[1].toLowerCase()];
  if (!extension) return null;

  const buffer = Buffer.from(match[2], "base64");
  await mkdir(OUTPUT_DIR, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(OUTPUT_DIR, filename), buffer);
  return `${QC_UPLOADS_PUBLIC_PREFIX}/${filename}`;
}

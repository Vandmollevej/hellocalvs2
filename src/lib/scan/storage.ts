import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { stripImageMetadata } from "@/lib/image-metadata";

// Hyldebilleder gemmes i den delte product-images-volume
// (compose.production.yaml), som både app- og scan-app-containeren mounter.
// EXIF/GPS strippes fra filen; de præcise koordinater gemmes i stedet som
// felter på ShelfPhoto (docs/OPRETTELSES-APP.md "Lokation").
const PUBLIC_PREFIX = "/product-images/scan-shelves";
const OUTPUT_DIR = path.join(process.cwd(), "public", "product-images", "scan-shelves");

export async function saveShelfPhoto(dataUrl: string): Promise<string | null> {
  const match = /^data:image\/(jpe?g|png|webp);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const type = match[1].toLowerCase();
  const extension = type === "png" ? "png" : type === "webp" ? "webp" : "jpg";
  const mime = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
  const buffer = stripImageMetadata(Buffer.from(match[2], "base64"), mime);
  await mkdir(OUTPUT_DIR, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(OUTPUT_DIR, filename), buffer);
  return `${PUBLIC_PREFIX}/${filename}`;
}

// Tandhjul → slet: filen fjernes helt (brugerbeslutning 2026-09-24).
export async function deleteShelfPhotoFile(imageUrl: string) {
  if (!imageUrl.startsWith(`${PUBLIC_PREFIX}/`)) return;
  const filename = path.basename(imageUrl);
  await unlink(path.join(OUTPUT_DIR, filename)).catch(() => {});
}

// Absolut filsti til et gemt hyldebillede (til AI-analysen).
export function shelfPhotoPath(imageUrl: string) {
  return path.join(OUTPUT_DIR, path.basename(imageUrl));
}

// Butik ud fra koordinater via Google Places API (New), hvis
// GOOGLE_PLACES_API_KEY er sat. Mangler nøglen, eller fejler kaldet, gemmes
// billedet blot uden butiksnavn.
export async function lookupStoreName(latitude: number, longitude: number): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.displayName",
      },
      body: JSON.stringify({
        includedTypes: ["supermarket", "grocery_store", "convenience_store", "discount_store"],
        maxResultCount: 1,
        rankPreference: "DISTANCE",
        locationRestriction: { circle: { center: { latitude, longitude }, radius: 150 } },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { places?: { displayName?: { text?: string } }[] };
    return data.places?.[0]?.displayName?.text?.trim() || null;
  } catch {
    return null;
  }
}

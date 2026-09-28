import { readFile, stat } from "node:fs/promises";
import path from "node:path";

// Billeder, som agenterne lægger i /public-volumerne (product-images,
// hellofresh-images — compose.production.yaml) EFTER at appen er startet,
// kender Next's standalone-server ikke: den læser public-mappen én gang ved
// opstart. Filer lagt op senere gav derfor 404 indtil næste genstart. Denne
// fallback-route serverer dem direkte fra disken (docs/DECISIONS.md
// 2026-09-28). Kendte filer serveres stadig af Next selv.

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function servePublicVolumeFile(folder: "product-images" | "hellofresh-images", segments: string[]) {
  const root = path.join(process.cwd(), "public", folder);
  const target = path.resolve(root, ...segments);
  const type = TYPES[path.extname(target).toLowerCase()];
  if (!type || !target.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const info = await stat(target);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const body = await readFile(target);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=3600",
        // SVG kan indeholde scripts; vis den aldrig som et aktivt dokument.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

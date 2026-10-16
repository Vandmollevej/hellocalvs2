import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { renderCircleComposite } from "@/lib/product-circle-composite";

// Fritskrabet produktbillede med cirklen bagt ind (kun hjemmesiden, bruger
// 2026-10-16). Kilden er en af vores egne filer under /product-images/.
const CACHE = new Map<string, Buffer>();
const CACHE_MAX = 200;

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get("src") ?? "";
  const prefix = "/product-images/";
  if (!src.startsWith(prefix) || !/\.(png|webp|jpe?g)$/i.test(src)) return new Response("Bad request", { status: 400 });
  const root = path.join(process.cwd(), "public", "product-images");
  const target = path.resolve(root, src.slice(prefix.length));
  if (!target.startsWith(root + path.sep)) return new Response("Bad request", { status: 400 });
  try {
    const info = await stat(target);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const etag = `W/"c-${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = { ETag: etag, "Cache-Control": "private, max-age=3600" };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    let body = CACHE.get(etag);
    if (!body) {
      body = await renderCircleComposite(await readFile(target));
      if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
      CACHE.set(etag, body);
    }
    return new Response(new Uint8Array(body), {
      headers: { ...headers, "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

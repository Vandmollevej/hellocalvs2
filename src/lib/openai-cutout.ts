import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { debugLog } from "@/lib/debug-log";

// Nyt fritlægningsforsøg hos OpenAI, når admin afviser robottens (rembg)
// forslag. Originalfotoet sendes til OpenAI's billedredigering med en prompt,
// der forbyder at opfinde noget; resultatet kommer tilbage som nyt forslag
// (pendingImageUrl) til godkendelse. Se docs/DECISIONS.md 2026-10-17.

const PRODUCT_IMAGES_DIR = path.join(process.cwd(), "public", "product-images");
const CUTOUT_DIR = path.join(PRODUCT_IMAGES_DIR, "cutouts");
const PUBLIC_PREFIX = "/product-images";
export const OPENAI_CUTOUT_FILE_PREFIX = "openai-";

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

const PROMPT = [
  "Cut out the product shown on the front of the packaging in this photo and place it on a fully transparent background.",
  "Do NOT invent, add, redraw, restyle, translate or change anything.",
  "Keep the product exactly as photographed: shape, proportions, colours, text, logos, label and every graphic detail must stay pixel-faithful to the photo.",
  "Do not fill in or complete parts that are hidden, cut off or unreadable; leave them as they are.",
  "Remove only the background and everything that is not the product (hands, shelves, price tags, other products, reflections outside the product).",
  "Output the product alone, centered, with a tight crop and a clean edge.",
].join(" ");

export type OpenAiCutoutResult = { ok: true; url: string } | { ok: false; message: string };

function openAiModel() {
  return process.env.OPENAI_IMAGE_EDIT_MODEL?.trim() || "gpt-image-1";
}

async function loadSource(sourceUrl: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (sourceUrl.startsWith("https://")) {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!/^image\/(png|jpe?g|webp)$/i.test(mime)) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.length <= MAX_SOURCE_BYTES ? { buffer, mime } : null;
  }
  if (!sourceUrl.startsWith(`${PUBLIC_PREFIX}/`)) return null;
  const file = path.resolve(PRODUCT_IMAGES_DIR, sourceUrl.slice(PUBLIC_PREFIX.length + 1));
  if (!file.startsWith(PRODUCT_IMAGES_DIR + path.sep)) return null;
  const buffer = await readFile(file).catch(() => null);
  if (!buffer || buffer.length > MAX_SOURCE_BYTES) return null;
  const ext = path.extname(file).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { buffer, mime };
}

// Kun ét OpenAI-forsøg pr. vare: er det nuværende forslag allerede fra OpenAI,
// afvises det helt som før.
export function isOpenAiCutoutUrl(url: string | null | undefined) {
  return Boolean(url?.includes(`/cutouts/${OPENAI_CUTOUT_FILE_PREFIX}`));
}

export async function retryCutoutWithOpenAi(productId: string): Promise<OpenAiCutoutResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, message: "OPENAI_API_KEY er ikke sat" };

  const job = await prisma.imageCutoutJob.findFirst({
    where: { productId, kind: "PRODUCT_FRONT" },
    orderBy: { createdAt: "desc" },
    select: { sourceUrl: true },
  });
  if (!job) return { ok: false, message: "Ingen original at sende til OpenAI" };

  const source = await loadSource(job.sourceUrl);
  if (!source) return { ok: false, message: "Originalfotoet kunne ikke læses" };

  const form = new FormData();
  form.set("model", openAiModel());
  form.set("prompt", PROMPT);
  form.set("background", "transparent");
  form.set("output_format", "png");
  form.set("input_fidelity", "high");
  form.set("quality", "high");
  form.set("image", new Blob([new Uint8Array(source.buffer)], { type: source.mime }), `original.${source.mime.split("/")[1]}`);

  try {
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(110_000),
    });
    const body = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[]; error?: { message?: string } } | null;
    const b64 = body?.data?.[0]?.b64_json;
    if (!res.ok || !b64) {
      const message = body?.error?.message ?? `OpenAI svarede ${res.status}`;
      void debugLog({ category: "ai", event: "openai-cutout", level: "error", message });
      return { ok: false, message };
    }
    await mkdir(CUTOUT_DIR, { recursive: true });
    const filename = `${OPENAI_CUTOUT_FILE_PREFIX}${randomUUID()}.png`;
    await writeFile(path.join(CUTOUT_DIR, filename), Buffer.from(b64, "base64"));
    return { ok: true, url: `${PUBLIC_PREFIX}/cutouts/${filename}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI-kaldet fejlede";
    void debugLog({ category: "ai", event: "openai-cutout", level: "error", message });
    return { ok: false, message };
  }
}

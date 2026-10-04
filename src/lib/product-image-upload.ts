import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeBrandName } from "@/lib/brand-match";
import { stripImageMetadata } from "@/lib/image-metadata";
import { IMAGE_TAG_MULTIPLE, IMAGE_TAG_RAW } from "@/lib/image-tags";
import { formatBytes, formatDimensions } from "@/lib/brand-logo-upload-types";
import {
  PRODUCT_IMAGE_MAX_UPLOAD_BYTES,
  ROLE_LABEL,
  parseProductImageName,
  type ImageKeyKind,
  type ImageRole,
  type ImageStep,
  type ProductImageClientMeta,
  type ProductImageTarget,
  type ProductImageUploadItem,
} from "@/lib/product-image-upload-types";

// Server-siden af admin → Varedatabase → Billed-upload (docs/DECISIONS.md
// 2026-10-04). Reglen: kun filer opkaldt efter et EAN eller en produkttype
// (evt. med _raw / _pl til sidst) lægges op. Findes der allerede et billede på
// pladsen, bliver det nye liggende som CONFLICT, til admin vælger Ignorer /
// Erstat. Alt, der kan fortrydes, gemmes på rækken, så et helt parti kan slettes.

const PUBLIC_DIR = path.join(process.cwd(), "public");
export const PRODUCT_UPLOAD_PUBLIC_PREFIX = "/product-images/product-uploads";
const PRODUCT_UPLOAD_DIR = path.join(PUBLIC_DIR, "product-images", "product-uploads");

const MAX_SIDE = 8192;
const MAX_TARGETS = 50;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Det, der gemmes i `targets`: de offentlige felter + hvad der skal til at fortryde.
type StoredTarget = ProductImageTarget & {
  applied?: boolean;
  previousImageUrl?: string | null;
  replacedRows?: { url: string; tags: string[]; order: number }[];
  createdRowId?: string;
};

type Sniffed = { mime: "image/png" | "image/jpeg" | "image/webp"; ext: "png" | "jpg" | "webp"; width: number; height: number };

// --- billedkontrol -------------------------------------------------------

function sized(mime: Sniffed["mime"], ext: Sniffed["ext"], width: number, height: number): Sniffed | null {
  if (width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) return null;
  return { mime, ext, width, height };
}

// Læser filtype og mål direkte fra bytes (PNG, JPEG, WebP) — filendelsen stoles ikke på.
export function sniffImage(buf: Buffer): Sniffed | null {
  if (buf.length >= 33 && buf.subarray(0, 8).equals(PNG_SIGNATURE) && buf.toString("latin1", 12, 16) === "IHDR") {
    return sized("image/png", "png", buf.readUInt32BE(16), buf.readUInt32BE(20));
  }
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8) {
    let pos = 2;
    while (pos + 9 < buf.length) {
      if (buf[pos] !== 0xff) {
        pos += 1;
        continue;
      }
      const marker = buf[pos + 1];
      if (marker === 0xff) {
        pos += 1;
        continue;
      }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return sized("image/jpeg", "jpg", buf.readUInt16BE(pos + 7), buf.readUInt16BE(pos + 5));
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        pos += 2;
        continue;
      }
      pos += 2 + buf.readUInt16BE(pos + 2);
    }
    return null;
  }
  if (buf.length >= 30 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    const type = buf.toString("latin1", 12, 16);
    if (type === "VP8X") return sized("image/webp", "webp", 1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3));
    if (type === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return sized("image/webp", "webp", (bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
    }
    if (type === "VP8 ") return sized("image/webp", "webp", buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff);
  }
  return null;
}

// --- klientoplysninger ---------------------------------------------------

function cleanSteps(steps: unknown): ImageStep[] {
  if (!Array.isArray(steps)) return [];
  const statuses = new Set(["ok", "skipped", "warn", "error"]);
  return steps.slice(0, 30).flatMap((raw): ImageStep[] => {
    if (!raw || typeof raw !== "object") return [];
    const step = raw as Record<string, unknown>;
    if (typeof step.key !== "string" || typeof step.label !== "string") return [];
    const status = typeof step.status === "string" && statuses.has(step.status) ? (step.status as ImageStep["status"]) : "ok";
    return [
      {
        key: step.key.slice(0, 40),
        label: step.label.slice(0, 80),
        status,
        ms: typeof step.ms === "number" && Number.isFinite(step.ms) ? Math.max(0, Math.round(step.ms)) : undefined,
        detail: typeof step.detail === "string" ? step.detail.slice(0, 400) : undefined,
      },
    ];
  });
}

function intOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

export function parseProductImageMeta(raw: unknown): ProductImageClientMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const meta = raw as Record<string, unknown>;
  if (typeof meta.fileName !== "string" || !meta.fileName.trim()) return null;
  return {
    fileName: meta.fileName.slice(0, 255),
    originalWidth: intOrNull(meta.originalWidth),
    originalHeight: intOrNull(meta.originalHeight),
    originalBytes: intOrNull(meta.originalBytes) ?? 0,
    originalType: typeof meta.originalType === "string" ? meta.originalType.slice(0, 80) : "",
    hasAlpha: meta.hasAlpha === true,
    steps: cleanSteps(meta.steps),
    failed: typeof meta.failed === "string" && meta.failed ? meta.failed.slice(0, 300) : undefined,
  };
}

// --- gemte targets -------------------------------------------------------

function cleanTargets(raw: unknown): StoredTarget[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): StoredTarget[] => {
    if (!entry || typeof entry !== "object") return [];
    const target = entry as Record<string, unknown>;
    if ((target.kind !== "product" && target.kind !== "generic") || typeof target.id !== "string") return [];
    return [
      {
        kind: target.kind,
        id: target.id,
        name: typeof target.name === "string" ? target.name : "",
        existingUrl: typeof target.existingUrl === "string" ? target.existingUrl : null,
        replacedUrl: typeof target.replacedUrl === "string" ? target.replacedUrl : null,
        applied: target.applied === true,
        previousImageUrl: typeof target.previousImageUrl === "string" ? target.previousImageUrl : null,
        replacedRows: Array.isArray(target.replacedRows)
          ? (target.replacedRows as { url: string; tags: string[]; order: number }[]).filter((row) => row && typeof row.url === "string")
          : undefined,
        createdRowId: typeof target.createdRowId === "string" ? target.createdRowId : undefined,
      },
    ];
  });
}

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

function tagFor(role: ImageRole) {
  return role === "RAW" ? IMAGE_TAG_RAW : IMAGE_TAG_MULTIPLE;
}

// --- visning -------------------------------------------------------------

type UploadRow = Prisma.ProductImageUploadGetPayload<object>;

export function toProductImageItem(row: UploadRow): ProductImageUploadItem {
  return {
    id: row.id,
    batchId: row.batchId,
    fileName: row.fileName,
    key: row.key,
    keyKind: (row.keyKind as ImageKeyKind | null) ?? null,
    role: (row.role as ImageRole | null) ?? null,
    status: row.status,
    imageUrl: row.imageUrl,
    hasAlpha: row.hasAlpha,
    originalWidth: row.originalWidth,
    originalHeight: row.originalHeight,
    originalBytes: row.originalBytes,
    originalType: row.originalType,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    targets: cleanTargets(row.targets).map((target) => ({
      kind: target.kind,
      id: target.id,
      name: target.name,
      existingUrl: target.existingUrl,
      replacedUrl: target.replacedUrl ?? null,
    })),
    steps: cleanSteps(row.steps),
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}

// --- find vare(r) --------------------------------------------------------

let genericIndex: { at: number; byKey: Map<string, string[]> } | null = null;

async function genericIdsByName(key: string) {
  if (!genericIndex || Date.now() - genericIndex.at > 20_000) {
    const rows = await prisma.genericIngredient.findMany({ select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] });
    const byKey = new Map<string, string[]>();
    for (const row of rows) {
      const normalized = normalizeBrandName(row.name);
      if (normalized) byKey.set(normalized, [...(byKey.get(normalized) ?? []), row.id]);
    }
    genericIndex = { at: Date.now(), byKey };
  }
  return genericIndex.byKey.get(normalizeBrandName(key)) ?? [];
}

// En 12-cifret UPC og dens 13-cifrede EAN er samme vare; stregkoden kan være gemt begge steder.
function eanVariants(code: string) {
  const stripped = code.replace(/^0+/, "");
  const variants = new Set<string>([code]);
  if (stripped) {
    variants.add(stripped);
    for (const length of [8, 12, 13, 14]) if (stripped.length <= length) variants.add(stripped.padStart(length, "0"));
  }
  return [...variants];
}

async function resolveTargets(
  keyKind: ImageKeyKind,
  key: string,
  role: ImageRole,
): Promise<{ targets: StoredTarget[] } | { error: string }> {
  type Base = { kind: "product" | "generic"; id: string; name: string; imageUrl: string | null };
  const bases: Base[] = [];

  if (keyKind === "EAN") {
    const barcode = await prisma.barcode.findFirst({
      where: { code: { in: eanVariants(key) } },
      select: { product: { select: { id: true, name: true, imageUrl: true } } },
    });
    if (!barcode) return { error: `Ingen vare har EAN ${key}` };
    bases.push({ kind: "product", ...barcode.product });
  } else {
    const genericIds = await genericIdsByName(key);
    if (genericIds.length > 0) {
      const generics = await prisma.genericIngredient.findMany({ where: { id: { in: genericIds } }, select: { id: true, name: true, imageUrl: true } });
      bases.push(...generics.map((generic): Base => ({ kind: "generic", ...generic })));
    }
    // Varer af denne produkttype uden brand (fx Banan). Pakkevarer med brand har deres eget EAN-billede.
    const products = await prisma.product.findMany({
      where: { productType: { equals: key, mode: "insensitive" }, brandId: null, privateOwnerId: null },
      select: { id: true, name: true, imageUrl: true },
      take: MAX_TARGETS + 1,
    });
    bases.push(...products.map((product): Base => ({ kind: "product", ...product })));
    if (bases.length === 0) return { error: `Ingen produkttype eller ingrediens hedder «${key}»` };
    if (bases.length > MAX_TARGETS) return { error: `«${key}» passer på mere end ${MAX_TARGETS} varer — brug EAN i stedet` };
  }

  // Hvad sidder der allerede på pladsen?
  const existing = new Map<string, string>();
  if (role === "MAIN") {
    for (const base of bases) if (base.imageUrl) existing.set(`${base.kind}:${base.id}`, base.imageUrl);
  } else {
    const tag = tagFor(role);
    const productIds = bases.filter((base) => base.kind === "product").map((base) => base.id);
    const genericIds = bases.filter((base) => base.kind === "generic").map((base) => base.id);
    const [productRows, genericRows] = await Promise.all([
      productIds.length
        ? prisma.productImage.findMany({ where: { productId: { in: productIds }, tags: { has: tag } }, orderBy: { order: "asc" }, select: { productId: true, url: true } })
        : [],
      genericIds.length
        ? prisma.genericIngredientImage.findMany({
            where: { genericIngredientId: { in: genericIds }, tags: { has: tag } },
            orderBy: { order: "asc" },
            select: { genericIngredientId: true, url: true },
          })
        : [],
    ]);
    for (const row of productRows) if (!existing.has(`product:${row.productId}`)) existing.set(`product:${row.productId}`, row.url);
    for (const row of genericRows) if (!existing.has(`generic:${row.genericIngredientId}`)) existing.set(`generic:${row.genericIngredientId}`, row.url);
  }

  return {
    targets: bases.map((base) => ({
      kind: base.kind,
      id: base.id,
      name: base.name,
      existingUrl: existing.get(`${base.kind}:${base.id}`) ?? null,
    })),
  };
}

// --- sæt og fortryd ------------------------------------------------------

async function applyTargets(tx: Prisma.TransactionClient, role: ImageRole, imageUrl: string, targets: StoredTarget[]): Promise<StoredTarget[]> {
  const result: StoredTarget[] = [];
  for (const target of targets) {
    const next: StoredTarget = { ...target, applied: false };
    if (role === "MAIN") {
      const current =
        target.kind === "product"
          ? await tx.product.findUnique({ where: { id: target.id }, select: { imageUrl: true } })
          : await tx.genericIngredient.findUnique({ where: { id: target.id }, select: { imageUrl: true } });
      if (current) {
        if (target.kind === "product") await tx.product.update({ where: { id: target.id }, data: { imageUrl } });
        else await tx.genericIngredient.update({ where: { id: target.id }, data: { imageUrl } });
        next.applied = true;
        next.previousImageUrl = current.imageUrl;
        next.replacedUrl = current.imageUrl;
      }
    } else {
      const tag = tagFor(role);
      if (target.kind === "product") {
        if (await tx.product.findUnique({ where: { id: target.id }, select: { id: true } })) {
          const replaced = await tx.productImage.findMany({ where: { productId: target.id, tags: { has: tag } }, orderBy: { order: "asc" } });
          if (replaced.length > 0) await tx.productImage.deleteMany({ where: { id: { in: replaced.map((row) => row.id) } } });
          const last = await tx.productImage.aggregate({ where: { productId: target.id }, _max: { order: true } });
          const created = await tx.productImage.create({ data: { productId: target.id, url: imageUrl, tags: [tag], order: (last._max.order ?? -1) + 1 } });
          next.applied = true;
          next.createdRowId = created.id;
          next.replacedRows = replaced.map((row) => ({ url: row.url, tags: row.tags, order: row.order }));
          next.replacedUrl = replaced[0]?.url ?? null;
        }
      } else if (await tx.genericIngredient.findUnique({ where: { id: target.id }, select: { id: true } })) {
        const replaced = await tx.genericIngredientImage.findMany({ where: { genericIngredientId: target.id, tags: { has: tag } }, orderBy: { order: "asc" } });
        if (replaced.length > 0) await tx.genericIngredientImage.deleteMany({ where: { id: { in: replaced.map((row) => row.id) } } });
        const last = await tx.genericIngredientImage.aggregate({ where: { genericIngredientId: target.id }, _max: { order: true } });
        const created = await tx.genericIngredientImage.create({
          data: { genericIngredientId: target.id, url: imageUrl, tags: [tag], order: (last._max.order ?? -1) + 1 },
        });
        next.applied = true;
        next.createdRowId = created.id;
        next.replacedRows = replaced.map((row) => ({ url: row.url, tags: row.tags, order: row.order }));
        next.replacedUrl = replaced[0]?.url ?? null;
      }
    }
    result.push(next);
  }
  return result;
}

async function undoTargets(tx: Prisma.TransactionClient, role: ImageRole, imageUrl: string, targets: StoredTarget[]) {
  for (const target of targets) {
    if (!target.applied) continue;
    if (role === "MAIN") {
      // Kun hvis billedet stadig er varens hovedbillede.
      if (target.kind === "product") {
        await tx.product.updateMany({ where: { id: target.id, imageUrl }, data: { imageUrl: target.previousImageUrl ?? null } });
      } else {
        await tx.genericIngredient.updateMany({ where: { id: target.id, imageUrl }, data: { imageUrl: target.previousImageUrl ?? null } });
      }
      continue;
    }
    if (!target.createdRowId) continue;
    // De erstattede rækker kommer kun tilbage, hvis vores række stadig sad der.
    if (target.kind === "product") {
      const removed = await tx.productImage.deleteMany({ where: { id: target.createdRowId } });
      if (removed.count > 0 && target.replacedRows?.length) {
        if (await tx.product.findUnique({ where: { id: target.id }, select: { id: true } })) {
          await tx.productImage.createMany({ data: target.replacedRows.map((row) => ({ productId: target.id, url: row.url, tags: row.tags, order: row.order })) });
        }
      }
    } else {
      const removed = await tx.genericIngredientImage.deleteMany({ where: { id: target.createdRowId } });
      if (removed.count > 0 && target.replacedRows?.length) {
        if (await tx.genericIngredient.findUnique({ where: { id: target.id }, select: { id: true } })) {
          await tx.genericIngredientImage.createMany({
            data: target.replacedRows.map((row) => ({ genericIngredientId: target.id, url: row.url, tags: row.tags, order: row.order })),
          });
        }
      }
    }
  }
}

// Kontrol og anvendelse sker én ad gangen, så to filer til samme vare i ét drop
// ikke begge tror, pladsen er ledig.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work);
  queue = run.catch(() => undefined);
  return run;
}

async function removeUploadFiles(urls: (string | null | undefined)[]) {
  await Promise.all(
    urls.map(async (url) => {
      if (!url || !url.startsWith(`${PRODUCT_UPLOAD_PUBLIC_PREFIX}/`)) return;
      const file = path.resolve(PUBLIC_DIR, "." + url);
      if (!file.startsWith(PRODUCT_UPLOAD_DIR + path.sep)) return;
      await unlink(file).catch(() => undefined);
    }),
  );
}

// --- upload --------------------------------------------------------------

export async function ingestProductImage(batchId: string, meta: ProductImageClientMeta, upload: Buffer | null): Promise<ProductImageUploadItem> {
  const parsed = parseProductImageName(meta.fileName);
  const steps: ImageStep[] = [...meta.steps];
  const common = {
    batchId,
    fileName: meta.fileName,
    key: parsed.ok ? parsed.key : null,
    keyKind: parsed.ok ? parsed.keyKind : null,
    role: parsed.ok ? parsed.role : null,
    hasAlpha: meta.hasAlpha,
    originalWidth: meta.originalWidth,
    originalHeight: meta.originalHeight,
    originalBytes: meta.originalBytes || null,
    originalType: meta.originalType || null,
  };
  const record = async (status: UploadRow["status"], message: string | null, extra: Partial<Prisma.ProductImageUploadUncheckedCreateInput> = {}) =>
    toProductImageItem(
      await prisma.productImageUpload.create({
        data: { ...common, status, message, steps: asJson(steps), targets: asJson([]), ...extra },
      }),
    );

  // 1. Navnereglen (EAN eller produkttype, evt. _raw / _pl)
  let started = performance.now();
  if (!parsed.ok) {
    steps.unshift({ key: "name", label: "Tjekker filnavn", status: "error", ms: Math.round(performance.now() - started), detail: parsed.reason });
    return record("REJECTED", parsed.reason);
  }
  steps.push({
    key: "name",
    label: "Tjekker filnavn",
    status: "ok",
    ms: Math.round(performance.now() - started),
    detail: `${parsed.keyKind === "EAN" ? "EAN" : "Produkttype"} «${parsed.key}» · ${ROLE_LABEL[parsed.role]}`,
  });
  if (meta.failed || !upload) {
    return record("FAILED", meta.failed ?? "Ingen billedfil modtaget");
  }

  // 2. Modtag og kontrollér billedet (ingen metadata/GPS må blive liggende)
  started = performance.now();
  if (upload.length > PRODUCT_IMAGE_MAX_UPLOAD_BYTES) {
    steps.push({ key: "receive", label: "Modtager og kontrollerer", status: "error", detail: `Filen er for stor (${formatBytes(upload.length)})` });
    return record("FAILED", `Filen er for stor (${formatBytes(upload.length)})`);
  }
  const sniffedRaw = sniffImage(upload);
  let clean: Buffer | null = null;
  if (sniffedRaw) {
    try {
      clean = stripImageMetadata(upload, sniffedRaw.mime);
    } catch {
      clean = null;
    }
  }
  const sniffed = clean ? sniffImage(clean) : null;
  if (!clean || !sniffed) {
    steps.push({ key: "receive", label: "Modtager og kontrollerer", status: "error", detail: "Filen er ikke et gyldigt PNG-, JPEG- eller WebP-billede" });
    return record("FAILED", "Filen er ikke et gyldigt PNG-, JPEG- eller WebP-billede");
  }
  steps.push({
    key: "receive",
    label: "Modtager og kontrollerer",
    status: "ok",
    ms: Math.round(performance.now() - started),
    detail: `${sniffed.ext.toUpperCase()} ${formatDimensions(sniffed.width, sniffed.height)} · ${formatBytes(clean.length)} (metadata fjernet)`,
  });
  const image = clean;

  return serial(async () => {
    // 3. Find vare(r)
    started = performance.now();
    const resolved = await resolveTargets(parsed.keyKind, parsed.key, parsed.role);
    if ("error" in resolved) {
      steps.push({ key: "target", label: "Finder vare", status: "error", ms: Math.round(performance.now() - started), detail: resolved.error });
      return record("REJECTED", resolved.error);
    }
    const targets = resolved.targets;
    steps.push({
      key: "target",
      label: "Finder vare",
      status: "ok",
      ms: Math.round(performance.now() - started),
      detail: targets.length === 1 ? targets[0].name : `${targets.length} varer: ${targets.slice(0, 3).map((target) => target.name).join(", ")}${targets.length > 3 ? " …" : ""}`,
    });

    // 4. Findes der allerede et billede?
    started = performance.now();
    const conflicts = targets.filter((target) => target.existingUrl);
    steps.push(
      conflicts.length === 0
        ? { key: "exists", label: "Tjekker om billedet findes", status: "ok", ms: Math.round(performance.now() - started), detail: "Pladsen er ledig" }
        : {
            key: "exists",
            label: "Tjekker om billedet findes",
            status: "warn",
            ms: Math.round(performance.now() - started),
            detail: `Der er allerede et billede på ${conflicts.length === 1 ? conflicts[0].name : `${conflicts.length} varer`} — afventer dit svar`,
          },
    );

    // 5. Gem filen
    started = performance.now();
    const fileName = `${randomUUID()}.${sniffed.ext}`;
    const imageUrl = `${PRODUCT_UPLOAD_PUBLIC_PREFIX}/${fileName}`;
    await mkdir(PRODUCT_UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(PRODUCT_UPLOAD_DIR, fileName), image);
    steps.push({ key: "store", label: "Gemmer filen", status: "ok", ms: Math.round(performance.now() - started), detail: imageUrl });
    const fileData = { imageUrl, width: sniffed.width, height: sniffed.height, bytes: image.length };

    try {
      if (conflicts.length > 0) {
        steps.push({ key: "apply", label: "Sætter billedet", status: "skipped", detail: "Ikke sat endnu — vælg Ignorer eller Erstat" });
        return await record("CONFLICT", "Findes allerede — vælg Ignorer, Erstat eller Vis forskel", { ...fileData, targets: asJson(targets) });
      }
      started = performance.now();
      const applied = await prisma.$transaction((tx) => applyTargets(tx, parsed.role, imageUrl, targets));
      const count = applied.filter((target) => target.applied).length;
      if (count === 0) {
        await removeUploadFiles([imageUrl]);
        steps.push({ key: "apply", label: "Sætter billedet", status: "error", detail: "Varen findes ikke længere" });
        return await record("FAILED", "Varen findes ikke længere");
      }
      steps.push({
        key: "apply",
        label: "Sætter billedet",
        status: "ok",
        ms: Math.round(performance.now() - started),
        detail: `${ROLE_LABEL[parsed.role]} sat på ${count === 1 ? applied.find((target) => target.applied)?.name : `${count} varer`}`,
      });
      return await record("APPLIED", null, { ...fileData, targets: asJson(applied) });
    } catch (error) {
      await removeUploadFiles([imageUrl]);
      throw error;
    }
  });
}

// --- Ignorer / Erstat ----------------------------------------------------

type Result = { ok: true; message?: string } | { ok: false; message: string };

export function resolveProductImageConflict(itemId: string, decision: "ignore" | "replace"): Promise<Result> {
  return serial(async (): Promise<Result> => {
    const item = await prisma.productImageUpload.findUnique({ where: { id: itemId } });
    if (!item || item.status !== "CONFLICT" || !item.imageUrl) return { ok: false, message: "Billedet venter ikke længere på et svar" };
    const steps = cleanSteps(item.steps);

    if (decision === "ignore") {
      steps.push({ key: "resolve", label: "Ignoreret", status: "skipped", detail: "Det nuværende billede er beholdt; den nye fil er slettet" });
      await prisma.productImageUpload.update({
        where: { id: item.id },
        data: { status: "IGNORED", imageUrl: null, message: "Ignoreret — det nuværende billede er beholdt", resolvedAt: new Date(), steps: asJson(steps) },
      });
      await removeUploadFiles([item.imageUrl]);
      return { ok: true };
    }

    const role = (item.role as ImageRole | null) ?? "MAIN";
    const started = performance.now();
    const applied = await prisma.$transaction((tx) => applyTargets(tx, role, item.imageUrl as string, cleanTargets(item.targets)));
    const count = applied.filter((target) => target.applied).length;
    if (count === 0) {
      steps.push({ key: "resolve", label: "Erstatter", status: "error", detail: "Varen findes ikke længere" });
      await prisma.productImageUpload.update({
        where: { id: item.id },
        data: { status: "FAILED", message: "Varen findes ikke længere", resolvedAt: new Date(), steps: asJson(steps) },
      });
      await removeUploadFiles([item.imageUrl]);
      return { ok: false, message: "Varen findes ikke længere" };
    }
    steps.push({
      key: "resolve",
      label: "Erstatter",
      status: "ok",
      ms: Math.round(performance.now() - started),
      detail: `Valgt: Erstat — det nye billede er sat på ${count === 1 ? applied.find((target) => target.applied)?.name : `${count} varer`} (det gamle gendannes ved sletning)`,
    });
    await prisma.productImageUpload.update({
      where: { id: item.id },
      data: { status: "APPLIED", message: null, targets: asJson(applied), resolvedAt: new Date(), steps: asJson(steps) },
    });
    return { ok: true };
  });
}

export async function resolveAllProductImageConflicts(decision: "ignore" | "replace"): Promise<{ done: number; failed: number }> {
  const waiting = await prisma.productImageUpload.findMany({ where: { status: "CONFLICT" }, select: { id: true }, orderBy: { createdAt: "asc" } });
  let done = 0;
  let failed = 0;
  for (const { id } of waiting) {
    const result = await resolveProductImageConflict(id, decision);
    if (result.ok) done += 1;
    else failed += 1;
  }
  return { done, failed };
}

// --- sletning ------------------------------------------------------------

// Sletter uploads (række + fil) og gendanner de tidligere billeder, hvor de
// slettede billeder stadig sad. Nyeste først, så en kæde af udskiftninger
// rulles tilbage i rigtig rækkefølge.
export async function deleteProductImageUploads(ids: string[]): Promise<{ deleted: number; restored: number }> {
  if (ids.length === 0) return { deleted: 0, restored: 0 };
  const ordered = await prisma.productImageUpload.findMany({
    where: { id: { in: ids } },
    select: { id: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const files: string[] = [];
  const batchIds = new Set<string>();
  let restored = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const { id } of ordered) {
        const item = await tx.productImageUpload.findUnique({ where: { id } });
        if (!item) continue;
        batchIds.add(item.batchId);
        if (item.imageUrl) {
          if (item.status === "APPLIED") {
            const targets = cleanTargets(item.targets);
            await undoTargets(tx, (item.role as ImageRole | null) ?? "MAIN", item.imageUrl, targets);
            restored += targets.filter((target) => target.applied).length;

            // Senere uploads, der erstattede dette billede, skal huske det, der kom før.
            const later = await tx.productImageUpload.findMany({
              where: { status: "APPLIED", createdAt: { gt: item.createdAt } },
              select: { id: true, targets: true },
            });
            for (const other of later) {
              let changed = false;
              const patched = cleanTargets(other.targets).map((target) => {
                let next = target;
                if (target.previousImageUrl === item.imageUrl) {
                  const mine = targets.find((candidate) => candidate.kind === target.kind && candidate.id === target.id);
                  next = { ...next, previousImageUrl: mine?.previousImageUrl ?? null };
                  changed = true;
                }
                if (target.replacedRows?.some((row) => row.url === item.imageUrl)) {
                  next = { ...next, replacedRows: target.replacedRows.filter((row) => row.url !== item.imageUrl) };
                  changed = true;
                }
                return next;
              });
              if (changed) await tx.productImageUpload.update({ where: { id: other.id }, data: { targets: asJson(patched) } });
            }
          }
          files.push(item.imageUrl);
        }
        await tx.productImageUpload.delete({ where: { id: item.id } });
      }
      for (const batchId of batchIds) {
        const left = await tx.productImageUpload.count({ where: { batchId } });
        if (left === 0) await tx.productImageUploadBatch.deleteMany({ where: { id: batchId } });
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  await removeUploadFiles(files);
  return { deleted: ordered.length, restored };
}

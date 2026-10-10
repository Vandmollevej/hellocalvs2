import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeBrandName } from "@/lib/brand-match";
import { stripImageMetadata } from "@/lib/image-metadata";
import { findSubbrandName, invalidateSubbrandLogoCache } from "@/lib/subbrand-logo";
import {
  LOGO_MAX_UPLOAD_BYTES,
  formatBytes,
  formatDimensions,
  parseLogoFileName,
  type LogoClientMeta,
  type LogoStep,
  type LogoUploadItem,
} from "@/lib/brand-logo-upload-types";

// Server-siden af admin → Varedatabase → Logo-upload (docs/DECISIONS.md
// 2026-10-04). Browseren har allerede beskåret/nedskaleret logoet til en PNG;
// her kontrolleres PNG'en, brandet findes ud fra filnavnet, filen gemmes i
// den delte /product-images-volume, og brandets logo sættes. Alt, der kan
// fortrydes (tidligere logo), gemmes på rækken, så et helt parti kan slettes.

const PUBLIC_DIR = path.join(process.cwd(), "public");
export const LOGO_UPLOAD_PUBLIC_PREFIX = "/product-images/brand-logos/uploads";
const LOGO_UPLOAD_DIR = path.join(PUBLIC_DIR, "product-images", "brand-logos", "uploads");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_SIDE = 4096;

// --- små hjælpere --------------------------------------------------------

function pngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.toString("latin1", 12, 16) !== "IHDR") return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) return null;
  return { width, height };
}

function cleanSteps(steps: unknown): LogoStep[] {
  if (!Array.isArray(steps)) return [];
  const statuses = new Set(["ok", "skipped", "warn", "error"]);
  return steps.slice(0, 20).flatMap((raw): LogoStep[] => {
    if (!raw || typeof raw !== "object") return [];
    const step = raw as Record<string, unknown>;
    if (typeof step.key !== "string" || typeof step.label !== "string") return [];
    const status = typeof step.status === "string" && statuses.has(step.status) ? (step.status as LogoStep["status"]) : "ok";
    return [
      {
        key: step.key.slice(0, 40),
        label: step.label.slice(0, 80),
        status,
        ms: typeof step.ms === "number" && Number.isFinite(step.ms) ? Math.max(0, Math.round(step.ms)) : undefined,
        detail: typeof step.detail === "string" ? step.detail.slice(0, 300) : undefined,
      },
    ];
  });
}

function intOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

export function parseClientMeta(raw: unknown): LogoClientMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const meta = raw as Record<string, unknown>;
  if (typeof meta.fileName !== "string" || !meta.fileName.trim()) return null;
  return {
    fileName: meta.fileName.slice(0, 255),
    originalWidth: intOrNull(meta.originalWidth),
    originalHeight: intOrNull(meta.originalHeight),
    originalBytes: intOrNull(meta.originalBytes) ?? 0,
    originalType: typeof meta.originalType === "string" ? meta.originalType.slice(0, 80) : "",
    steps: cleanSteps(meta.steps),
    failed: typeof meta.failed === "string" && meta.failed ? meta.failed.slice(0, 300) : undefined,
  };
}

// --- brandopslag ---------------------------------------------------------

type BrandRef = { id: string; name: string };
let brandIndex: { at: number; byKey: Map<string, BrandRef> } | null = null;

async function brandsByKey() {
  if (brandIndex && Date.now() - brandIndex.at < 20_000) return brandIndex.byKey;
  const brands = await prisma.brand.findMany({ select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] });
  const byKey = new Map<string, BrandRef>();
  for (const brand of brands) {
    const key = normalizeBrandName(brand.name);
    if (key && !byKey.has(key)) byKey.set(key, brand);
  }
  brandIndex = { at: Date.now(), byKey };
  return byKey;
}

export function invalidateBrandIndex() {
  brandIndex = null;
}

// Filerne i et parti behandles flere ad gangen; to filer til samme brand
// (Arla.png og Arla_2.png) må ikke sætte logoet samtidig.
const brandLocks = new Map<string, Promise<unknown>>();
async function withBrandLock<T>(brandId: string, work: () => Promise<T>): Promise<T> {
  const previous = brandLocks.get(brandId) ?? Promise.resolve();
  const run = previous.then(work);
  const tail = run.catch(() => undefined);
  brandLocks.set(brandId, tail);
  try {
    return await run;
  } finally {
    if (brandLocks.get(brandId) === tail) brandLocks.delete(brandId);
  }
}

// --- visning -------------------------------------------------------------

type UploadRow = Prisma.BrandLogoUploadGetPayload<{
  include: { brand: { select: { name: true; logoUrl: true } }; subbrandLogo: { select: { logoUrl: true } } };
}>;

export function toUploadItem(row: UploadRow): LogoUploadItem {
  return {
    id: row.id,
    batchId: row.batchId,
    fileName: row.fileName,
    suggestedName: parseLogoFileName(row.fileName).baseName,
    status: row.status,
    brandId: row.brandId,
    // Et subbrand-logo (docs/DECISIONS.md 2026-10-10) vises med navnet + "(subbrand)".
    brandName: row.brand?.name ?? (row.subbrandName ? `${row.subbrandName} (subbrand)` : null),
    imageUrl: row.imageUrl,
    applied: row.applied,
    inUse: Boolean(
      row.imageUrl &&
        ((row.brand && row.brand.logoUrl === row.imageUrl) ||
          (row.subbrandLogo && row.subbrandLogo.logoUrl === row.imageUrl)),
    ),
    hadPreviousLogo: Boolean(row.previousLogoUrl),
    originalWidth: row.originalWidth,
    originalHeight: row.originalHeight,
    originalBytes: row.originalBytes,
    originalType: row.originalType,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    steps: cleanSteps(row.steps),
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

export const logoUploadInclude = {
  brand: { select: { name: true, logoUrl: true } },
  subbrandLogo: { select: { logoUrl: true } },
} as const;

type LogoFileData = {
  batchId: string;
  fileName: string;
  originalWidth: number | null;
  originalHeight: number | null;
  originalBytes: number | null;
  originalType: string | null;
  imageUrl: string;
  width: number;
  height: number;
  bytes: number;
};

// Gemmer PNG'en med nyt navn pr. upload, så ingen gammel cache rammer.
async function storeLogoFile(png: Buffer, steps: LogoStep[]): Promise<string> {
  const started = performance.now();
  const fileName = `${randomUUID()}.png`;
  const imageUrl = `${LOGO_UPLOAD_PUBLIC_PREFIX}/${fileName}`;
  await mkdir(LOGO_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(LOGO_UPLOAD_DIR, fileName), png);
  steps.push({
    key: "store",
    label: "Gemmer filen",
    status: "ok",
    ms: Math.round(performance.now() - started),
    detail: imageUrl,
  });
  return imageUrl;
}

// Sætter filen som subbrandets logo (docs/DECISIONS.md 2026-10-10). Som ved
// brands sættes en ekstra udgave ikke, hvis subbrandet allerede har fået logo
// fra samme parti, og det tidligere logo huskes, så sletning gendanner det.
async function applySubbrandUpload(
  batchId: string,
  subbrandName: string,
  variant: number | null,
  fileData: LogoFileData,
  steps: LogoStep[],
): Promise<LogoUploadItem> {
  try {
    return await withBrandLock(`subbrand:${normalizeBrandName(subbrandName)}`, async () => {
      const started = performance.now();
      const current = await prisma.subbrandLogo.findUnique({ where: { name: subbrandName }, select: { logoUrl: true } });
      const alreadyFromBatch =
        variant !== null &&
        (await prisma.brandLogoUpload.count({ where: { batchId, subbrandName, applied: true } })) > 0;

      if (alreadyFromBatch) {
        steps.push({
          key: "apply",
          label: "Sætter som logo",
          status: "skipped",
          ms: Math.round(performance.now() - started),
          detail: `Ekstra udgave — subbrandet ${subbrandName} har allerede fået logo fra dette parti`,
        });
        const row = await prisma.brandLogoUpload.create({
          data: { ...fileData, subbrandName, status: "DONE", applied: false, steps: steps as unknown as Prisma.InputJsonValue },
          include: logoUploadInclude,
        });
        return toUploadItem(row);
      }

      const previousLogoUrl = current?.logoUrl ?? null;
      steps.push({
        key: "apply",
        label: "Sætter som logo",
        status: "ok",
        ms: Math.round(performance.now() - started),
        detail: previousLogoUrl
          ? `Sat på subbrandet ${subbrandName} — erstattede det tidligere logo (gendannes ved sletning)`
          : `Sat på subbrandet ${subbrandName}`,
      });
      const [, row] = await prisma.$transaction([
        prisma.subbrandLogo.upsert({
          where: { name: subbrandName },
          create: { name: subbrandName, logoUrl: fileData.imageUrl },
          update: { logoUrl: fileData.imageUrl },
        }),
        prisma.brandLogoUpload.create({
          data: {
            ...fileData,
            subbrandName,
            status: "DONE",
            applied: true,
            previousLogoUrl,
            steps: steps as unknown as Prisma.InputJsonValue,
          },
          include: logoUploadInclude,
        }),
      ]);
      invalidateSubbrandLogoCache();
      return toUploadItem(row);
    });
  } catch (error) {
    await removeLogoFiles([fileData.imageUrl]);
    throw error;
  }
}

// --- upload --------------------------------------------------------------

export async function ingestLogoUpload(batchId: string, meta: LogoClientMeta, upload: Buffer | null): Promise<LogoUploadItem> {
  const common = {
    batchId,
    fileName: meta.fileName,
    originalWidth: meta.originalWidth,
    originalHeight: meta.originalHeight,
    originalBytes: meta.originalBytes || null,
    originalType: meta.originalType || null,
  };

  // Browseren kunne ikke behandle filen: gem fejlen og processen indtil da.
  if (meta.failed || !upload) {
    const row = await prisma.brandLogoUpload.create({
      data: {
        ...common,
        status: "FAILED",
        steps: meta.steps as unknown as Prisma.InputJsonValue,
        message: meta.failed ?? "Ingen billedfil modtaget",
      },
      include: logoUploadInclude,
    });
    return toUploadItem(row);
  }

  const steps: LogoStep[] = [...meta.steps];
  const failWith = async (label: string, message: string) => {
    steps.push({ key: "receive", label, status: "error", detail: message });
    const row = await prisma.brandLogoUpload.create({
      data: { ...common, status: "FAILED", steps: steps as unknown as Prisma.InputJsonValue, message },
      include: logoUploadInclude,
    });
    return toUploadItem(row);
  };

  // 1. Modtag og kontrollér PNG'en (ingen metadata må blive liggende)
  let started = performance.now();
  if (upload.length > LOGO_MAX_UPLOAD_BYTES) {
    return failWith("Modtager og kontrollerer", `Filen er for stor (${formatBytes(upload.length)})`);
  }
  let png: Buffer;
  let size: { width: number; height: number } | null;
  try {
    png = stripImageMetadata(upload, "image/png");
    size = pngSize(png);
  } catch {
    return failWith("Modtager og kontrollerer", "Filen er ikke en gyldig PNG");
  }
  if (!size) return failWith("Modtager og kontrollerer", "PNG'en har ugyldige mål");
  steps.push({
    key: "receive",
    label: "Modtager og kontrollerer",
    status: "ok",
    ms: Math.round(performance.now() - started),
    detail: `PNG ${formatDimensions(size.width, size.height)} · ${formatBytes(png.length)}`,
  });

  // 2. Find brandet ud fra filnavnet
  started = performance.now();
  const { baseName, variant } = parseLogoFileName(meta.fileName);
  const brand = (await brandsByKey()).get(normalizeBrandName(baseName)) ?? null;
  if (!brand) {
    // Hedder et subbrand på varerne som filen, bliver den subbrandets logo
    // (docs/DECISIONS.md 2026-10-10).
    const subbrandName = await findSubbrandName(baseName);
    if (subbrandName) {
      steps.push({
        key: "match",
        label: "Finder brand",
        status: "ok",
        ms: Math.round(performance.now() - started),
        detail: `«${baseName}» = subbrandet ${subbrandName}${variant ? ` (ekstra udgave ${variant})` : ""}`,
      });
      const imageUrl = await storeLogoFile(png, steps);
      const fileData = { ...common, imageUrl, width: size.width, height: size.height, bytes: png.length };
      return applySubbrandUpload(batchId, subbrandName, variant, fileData, steps);
    }
    // Uden præcist brand-/subbrand-match afvises filen og gemmes ikke, så databasen ikke
    // fyldes med logoer uden ejer (kun afvisningen står i oversigten).
    const message = `Afvist: intet brand eller subbrand hedder «${baseName}»`;
    steps.push({ key: "match", label: "Finder brand", status: "error", ms: Math.round(performance.now() - started), detail: message });
    const row = await prisma.brandLogoUpload.create({
      data: { ...common, status: "FAILED", steps: steps as unknown as Prisma.InputJsonValue, message },
      include: logoUploadInclude,
    });
    return toUploadItem(row);
  }
  steps.push({
    key: "match",
    label: "Finder brand",
    status: "ok",
    ms: Math.round(performance.now() - started),
    detail: `«${baseName}» = brandet ${brand.name}${variant ? ` (ekstra udgave ${variant})` : ""}`,
  });

  // 3. Gem filen
  const imageUrl = await storeLogoFile(png, steps);

  const fileData = { ...common, imageUrl, width: size.width, height: size.height, bytes: png.length };

  try {
    // 4. Sæt som brandets logo (en ekstra udgave sættes ikke, hvis brandet
    //    allerede har fået logo fra samme parti)
    return await withBrandLock(brand.id, async () => {
      started = performance.now();
      const current = await prisma.brand.findUnique({ where: { id: brand.id }, select: { logoUrl: true } });
      const alreadyFromBatch =
        variant !== null &&
        (await prisma.brandLogoUpload.count({ where: { batchId, brandId: brand.id, applied: true } })) > 0;

      if (alreadyFromBatch) {
        steps.push({
          key: "apply",
          label: "Sætter som logo",
          status: "skipped",
          ms: Math.round(performance.now() - started),
          detail: `Ekstra udgave — ${brand.name} har allerede fået logo fra dette parti. Tryk «Brug som logo» for at vælge denne i stedet`,
        });
        const row = await prisma.brandLogoUpload.create({
          data: { ...fileData, brandId: brand.id, status: "DONE", applied: false, steps: steps as unknown as Prisma.InputJsonValue },
          include: logoUploadInclude,
        });
        return toUploadItem(row);
      }

      const previousLogoUrl = current?.logoUrl ?? null;
      steps.push({
        key: "apply",
        label: "Sætter som logo",
        status: "ok",
        ms: Math.round(performance.now() - started),
        detail: previousLogoUrl ? `Sat på ${brand.name} — erstattede det tidligere logo (gendannes ved sletning)` : `Sat på ${brand.name}`,
      });
      const [row] = await prisma.$transaction([
        prisma.brandLogoUpload.create({
          data: {
            ...fileData,
            brandId: brand.id,
            status: "DONE",
            applied: true,
            previousLogoUrl,
            steps: steps as unknown as Prisma.InputJsonValue,
          },
          include: logoUploadInclude,
        }),
        prisma.brand.update({ where: { id: brand.id }, data: { logoUrl: imageUrl } }),
      ]);
      // Rækken blev læst, før brandet fik sit nye logo.
      return toUploadItem({ ...row, brand: { name: brand.name, logoUrl: imageUrl } });
    });
  } catch (error) {
    await removeLogoFiles([imageUrl]);
    throw error;
  }
}

// --- manuel tilknytning --------------------------------------------------

// Sætter en allerede uploadet fil som logo på et brand (fra "Vælg brand" ved
// filer uden match, og fra "Brug som logo" ved ekstra udgaver).
export async function applyUploadToBrand(itemId: string, brandId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  return withBrandLock(brandId, async () => {
    const item = await prisma.brandLogoUpload.findUnique({ where: { id: itemId } });
    if (!item || !item.imageUrl) return { ok: false, message: "Filen findes ikke længere" };
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true, name: true, logoUrl: true } });
    if (!brand) return { ok: false, message: "Brandet findes ikke" };
    if (brand.logoUrl === item.imageUrl) return { ok: true };

    const steps = cleanSteps(item.steps);
    steps.push({
      key: "apply",
      label: "Sætter som logo",
      status: "ok",
      detail: `Valgt manuelt: sat på ${brand.name}${brand.logoUrl ? " — erstattede det tidligere logo (gendannes ved sletning)" : ""}`,
    });
    await prisma.$transaction([
      prisma.brandLogoUpload.update({
        where: { id: item.id },
        data: {
          status: "DONE",
          brandId: brand.id,
          applied: true,
          previousLogoUrl: brand.logoUrl,
          message: null,
          steps: steps as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.brand.update({ where: { id: brand.id }, data: { logoUrl: item.imageUrl } }),
    ]);
    return { ok: true };
  });
}

// --- sletning ------------------------------------------------------------

async function removeLogoFiles(urls: string[]) {
  await Promise.all(
    urls.map(async (url) => {
      if (!url.startsWith(`${LOGO_UPLOAD_PUBLIC_PREFIX}/`)) return;
      const file = path.resolve(PUBLIC_DIR, "." + url);
      if (!file.startsWith(LOGO_UPLOAD_DIR + path.sep)) return;
      await unlink(file).catch(() => undefined);
    }),
  );
}

// Sletter uploads (række + fil) og gendanner brandets tidligere logo, hvis det
// slettede billede stadig var brandets logo. Nyeste først, så en kæde af
// udskiftninger (A → B → C) rulles tilbage i rigtig rækkefølge.
export async function deleteLogoUploads(ids: string[]): Promise<{ deleted: number; restored: number }> {
  if (ids.length === 0) return { deleted: 0, restored: 0 };
  const ordered = await prisma.brandLogoUpload.findMany({
    where: { id: { in: ids } },
    select: { id: true, batchId: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const files: string[] = [];
  const batchIds = new Set<string>();
  let restored = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const { id } of ordered) {
        const item = await tx.brandLogoUpload.findUnique({ where: { id } });
        if (!item) continue;
        batchIds.add(item.batchId);
        if (item.imageUrl) {
          if (item.brandId) {
            const brand = await tx.brand.findUnique({ where: { id: item.brandId }, select: { logoUrl: true } });
            if (brand && brand.logoUrl === item.imageUrl) {
              await tx.brand.update({ where: { id: item.brandId }, data: { logoUrl: item.previousLogoUrl } });
              restored += 1;
            }
          }
          // Subbrandets logo: det tidligere gendannes, ellers fjernes subbrand-logoet.
          if (item.subbrandName) {
            const logo = await tx.subbrandLogo.findUnique({ where: { name: item.subbrandName }, select: { logoUrl: true } });
            if (logo && logo.logoUrl === item.imageUrl) {
              if (item.previousLogoUrl) {
                await tx.subbrandLogo.update({ where: { name: item.subbrandName }, data: { logoUrl: item.previousLogoUrl } });
              } else {
                await tx.subbrandLogo.delete({ where: { name: item.subbrandName } });
              }
              restored += 1;
            }
          }
          // Filer, der huskede denne fil som "tidligere logo", husker nu den, der kom før.
          await tx.brandLogoUpload.updateMany({
            where: { previousLogoUrl: item.imageUrl },
            data: { previousLogoUrl: item.previousLogoUrl },
          });
          files.push(item.imageUrl);
        }
        await tx.brandLogoUpload.delete({ where: { id: item.id } });
      }
      // Tomme partier fjernes.
      for (const batchId of batchIds) {
        const left = await tx.brandLogoUpload.count({ where: { batchId } });
        if (left === 0) await tx.brandLogoUploadBatch.deleteMany({ where: { id: batchId } });
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  invalidateSubbrandLogoCache();
  await removeLogoFiles(files);
  return { deleted: ordered.length, restored };
}

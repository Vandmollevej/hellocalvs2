"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser, requireFullAdminUser } from "@/lib/require-admin";
import { applyUploadToBrand, deleteLogoUploads, invalidateBrandIndex } from "@/lib/brand-logo-upload";
import type { BrandSearchHit } from "@/lib/brand-logo-upload-types";

// Handlinger på siden Logo-upload (docs/DECISIONS.md 2026-10-04): vælg/opret
// brand til en fil uden match, brug en ekstra udgave som logo, og slet filer
// (et helt parti = alle dets filer; brandets tidligere logo gendannes).

type Result = { ok: true; message?: string } | { ok: false; message: string };

const PATH = "/admin/product-database/logo-upload";

export async function searchBrandsForLogo(query: string): Promise<BrandSearchHit[]> {
  if (!(await requireAdminUser())) return [];
  const q = query.trim().slice(0, 100);
  if (!q) return [];
  return prisma.brand.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    orderBy: [{ name: "asc" }],
    take: 8,
    select: { id: true, name: true, logoUrl: true },
  });
}

export async function assignLogoUpload(itemId: string, brandId: string): Promise<Result> {
  if (!(await requireFullAdminUser())) return { ok: false, message: "Kun fuld admin-adgang kan ændre logoer" };
  const result = await applyUploadToBrand(String(itemId), String(brandId));
  revalidatePath(PATH);
  return result.ok ? { ok: true } : result;
}

export async function createBrandForLogoUpload(itemId: string, rawName: string): Promise<Result> {
  if (!(await requireFullAdminUser())) return { ok: false, message: "Kun fuld admin-adgang kan ændre logoer" };
  const name = rawName.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!name) return { ok: false, message: "Skriv et brandnavn" };
  // Brand.name er unikt (store/små bogstaver tæller): findes navnet, bruges det.
  const existing = await prisma.brand.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  const brand = existing ?? (await prisma.brand.create({ data: { name }, select: { id: true } }));
  invalidateBrandIndex();
  const result = await applyUploadToBrand(String(itemId), brand.id);
  revalidatePath(PATH);
  return result.ok ? { ok: true, message: existing ? undefined : `Brandet «${name}» er oprettet` } : result;
}

export async function deleteLogoUploadItems(itemIds: string[]): Promise<Result> {
  if (!(await requireFullAdminUser())) return { ok: false, message: "Kun fuld admin-adgang kan slette logoer" };
  const ids = Array.isArray(itemIds) ? itemIds.map(String).slice(0, 5000) : [];
  if (ids.length === 0) return { ok: false, message: "Ingen logoer valgt" };
  const { deleted, restored } = await deleteLogoUploads(ids);
  revalidatePath(PATH);
  revalidatePath("/admin/product-database/brands");
  return {
    ok: true,
    message: `${deleted} ${deleted === 1 ? "logo" : "logoer"} slettet${restored > 0 ? `, ${restored} brand${restored === 1 ? "" : "s"} fik det tidligere logo tilbage` : ""}`,
  };
}

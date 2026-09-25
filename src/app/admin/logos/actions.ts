"use server";

import { copyFile, mkdir } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Admin vælger et logo fra logo-robottens kø (docs/LOGO-AGENT.md). Den valgte
// fil kopieres til brand-logos/<brandId>.png, så robotten kan slette alle
// hentede kandidater 7 dage efter afgørelsen uden at røre det valgte logo.

const PUBLIC_DIR = path.join(process.cwd(), "public");

export async function chooseLogo(form: FormData) {
  if (!(await requireAdminUser())) redirect("/admin/login");
  const candidateId = String(form.get("candidateId") ?? "");
  const candidate = await prisma.brandLogoCandidate.findUnique({ where: { id: candidateId }, include: { search: true } });
  if (!candidate || !candidate.imageUrl.startsWith("/product-images/brand-logos/")) return;

  const brandId = candidate.search.brandId;
  const logoUrl = `/product-images/brand-logos/${brandId}.png`;
  await mkdir(path.join(PUBLIC_DIR, "product-images", "brand-logos"), { recursive: true });
  await copyFile(path.join(PUBLIC_DIR, candidate.imageUrl), path.join(PUBLIC_DIR, logoUrl));

  await prisma.$transaction([
    prisma.brand.update({ where: { id: brandId }, data: { logoUrl } }),
    prisma.brandLogoSearch.update({
      where: { id: candidate.searchId },
      data: { status: "ACCEPTED", chosenCandidateId: candidate.id, resolvedAt: new Date() },
    }),
  ]);
  revalidatePath("/admin/logos");
}

export async function rejectAllLogos(form: FormData) {
  if (!(await requireAdminUser())) redirect("/admin/login");
  const searchId = String(form.get("searchId") ?? "");
  await prisma.brandLogoSearch.update({
    where: { id: searchId },
    data: { status: "NO_CANDIDATES", resolvedAt: new Date() },
  });
  revalidatePath("/admin/logos");
}

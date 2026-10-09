"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullAdminUser } from "@/lib/require-admin";

// Genkør logo (admin → Varedatabase → Brands): sætter brandets BRAND_LOGO-job
// til PENDING igen, så billedrobotten (scripts/image-agent/cutout.py) fritlægger
// det på ny med den nuværende kode og opdaterer brandets logo (med ?v= mod
// browser-cache). Kun jobbet, som brandets nuværende logo stammer fra, kan
// genkøres — et uploadet logo erstattes i stedet med "Erstat logo".

type Result = { ok: true; message: string } | { ok: false; message: string };

export async function rerunBrandLogo(brandId: string): Promise<Result> {
  if (!(await requireFullAdminUser())) return { ok: false, message: "Kun fuld admin-adgang kan genkøre logoer" };
  const id = String(brandId ?? "").slice(0, 100);
  if (!id) return { ok: false, message: "Ukendt brand" };

  const brand = await prisma.brand.findUnique({ where: { id }, select: { logoUrl: true } });
  if (!brand) return { ok: false, message: "Brandet findes ikke" };
  if (!brand.logoUrl) return { ok: false, message: "Brandet har intet logo at genkøre" };

  const baseUrl = brand.logoUrl.split("?")[0];
  const job = await prisma.imageCutoutJob.findFirst({
    where: { kind: "BRAND_LOGO", brandId: id, resultUrl: baseUrl },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!job) {
    return { ok: false, message: "Logoet stammer ikke fra et fritlægningsjob (uploadet?) — brug Erstat logo" };
  }

  await prisma.imageCutoutJob.update({
    where: { id: job.id },
    data: { status: "PENDING", appliedAt: null, processedAt: null, error: null },
  });
  revalidatePath("/admin/product-database/brands");
  return { ok: true, message: "Sat i kø — robotten genkører logoet inden for få minutter" };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullAdminUser } from "@/lib/require-admin";
import { resplitOffRecord } from "@/lib/off-store";

// Knapper på en enkelt OFF-vare (admin → Varedatabase → Open Food Facts → vare).

function barcodeFrom(formData: FormData) {
  return String(formData.get("barcode") ?? "").replace(/\D/g, "").slice(0, 14);
}

export async function resplitOffRecordAction(formData: FormData): Promise<void> {
  if (!(await requireFullAdminUser())) return;
  const barcode = barcodeFrom(formData);
  if (!barcode) return;
  await resplitOffRecord(barcode);
  revalidatePath(`/admin/product-database/open-food-facts/${barcode}`);
  revalidatePath("/admin/product-database/open-food-facts");
}

export async function toggleOffReviewedAction(formData: FormData): Promise<void> {
  if (!(await requireFullAdminUser())) return;
  const barcode = barcodeFrom(formData);
  if (!barcode) return;
  const row = await prisma.offProductRecord.findUnique({ where: { barcode }, select: { reviewedAt: true } });
  if (!row) return;
  await prisma.offProductRecord.update({
    where: { barcode },
    data: { reviewedAt: row.reviewedAt ? null : new Date() },
  });
  revalidatePath(`/admin/product-database/open-food-facts/${barcode}`);
  revalidatePath("/admin/product-database/open-food-facts");
}

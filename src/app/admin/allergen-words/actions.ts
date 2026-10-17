"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullAdminUser } from "@/lib/require-admin";
import { ALLERGEN_CATALOG } from "@/lib/allergens";
import { invalidateAllergenWords } from "@/lib/allergen-words";

// Handlinger på admin → Allergen-ord (docs/DECISIONS.md 2026-10-17).
const KEYS = new Set<string>(ALLERGEN_CATALOG.map((item) => item.key));

export async function decideAllergenWord(formData: FormData) {
  const admin = await requireFullAdminUser();
  if (!admin) return;
  const word = String(formData.get("word") ?? "").trim().toLowerCase();
  const decision = String(formData.get("decision") ?? "");
  const allergenKey = String(formData.get("allergenKey") ?? "");
  if (!word) return;
  if (decision === "approve") {
    if (!KEYS.has(allergenKey)) return;
    await prisma.allergenWord.update({
      where: { word },
      data: { status: "APPROVED", allergenKey, reviewedAt: new Date(), reviewedById: admin.id },
    });
  } else if (decision === "reject") {
    await prisma.allergenWord.update({ where: { word }, data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: admin.id } });
  } else if (decision === "pending") {
    await prisma.allergenWord.update({ where: { word }, data: { status: "PENDING", reviewedAt: new Date(), reviewedById: admin.id } });
  }
  invalidateAllergenWords();
  revalidatePath("/admin/allergen-words");
}

// Admin kan selv tilføje et ord, robotten ikke har fundet.
export async function addAllergenWord(formData: FormData) {
  const admin = await requireFullAdminUser();
  if (!admin) return;
  const word = String(formData.get("word") ?? "").trim().toLowerCase();
  const allergenKey = String(formData.get("allergenKey") ?? "");
  if (!/^[\p{L}]{3,40}$/u.test(word) || !KEYS.has(allergenKey)) return;
  await prisma.allergenWord.upsert({
    where: { word },
    create: { word, allergenKey, status: "APPROVED", source: "admin", reviewedAt: new Date(), reviewedById: admin.id },
    update: { allergenKey, status: "APPROVED", reviewedAt: new Date(), reviewedById: admin.id },
  });
  invalidateAllergenWords();
  revalidatePath("/admin/allergen-words");
}

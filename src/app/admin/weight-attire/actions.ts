"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Gemmer algoritmen, der gætter tøjet ved en vejning (docs/DECISIONS.md 2026-10-07).
function clamp(value: FormDataEntryValue | null, min: number, max: number, fallback: number) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export async function saveWeightAttireSettings(form: FormData) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const data = {
    enabled: form.get("enabled") === "on",
    lookbackCount: Math.round(clamp(form.get("lookbackCount"), 1, 100, 10)),
    windowHours: clamp(form.get("windowHours"), 0.25, 12, 1.5),
    underwearBefore: Math.round(clamp(form.get("underwearBefore"), 0, 24, 8)),
    syncStaleHours: Math.round(clamp(form.get("syncStaleHours"), 1, 24 * 30, 48)),
  };
  await prisma.weightAttireSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  revalidatePath("/admin/weight-attire");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { assessOffProducts } from "@/lib/off-quality-job";
import { OFF_QUALITY_PATH, offQualityWhere, parseOffQualityFilters } from "@/lib/off-quality-query";

// Server actions til admin → Scan-invites → "Open Food Facts-kontrol"
// (docs/DECISIONS.md 2026-10-11). Hver action tjekker selv admin-sessionen.

async function admin() {
  const user = await requireAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}

// Tilbage til samme visning (filtre + side) med en besked; kun interne adresser.
function returnUrl(form: FormData, notice: string, count?: number) {
  const raw = form.get("returnTo");
  const target = typeof raw === "string" && raw.startsWith(OFF_QUALITY_PATH) ? raw : OFF_QUALITY_PATH;
  const url = new URL(target, "http://local");
  url.searchParams.set("notice", notice);
  if (count !== undefined) url.searchParams.set("n", String(count));
  return `${url.pathname}${url.search}`;
}

function selectedIds(form: FormData) {
  return [...new Set(form.getAll("ids").filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 2000);
}

// Valgte varer → scan-appen: de står som "ikke scannet", til en agent har
// oprettet/suppleret dem. En vare, der allerede er scannet, kan sendes igen.
export async function sendToScanApp(form: FormData) {
  const user = await admin();
  const ids = selectedIds(form);
  if (ids.length === 0) redirect(returnUrl(form, "none"));
  const result = await prisma.productQualityReview.updateMany({
    where: { productId: { in: ids } },
    data: { scanRequestedAt: new Date(), scanRequestedByAdminId: user.id, scanDoneAt: null, scanDoneByWorkerId: null },
  });
  revalidatePath(OFF_QUALITY_PATH);
  redirect(returnUrl(form, "sent", result.count));
}

// Alle varer, der matcher de viste filtre (også på andre sider).
export async function sendAllMatchingToScanApp(form: FormData) {
  const user = await admin();
  const raw = form.get("returnTo");
  const search = typeof raw === "string" && raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
  const filters = parseOffQualityFilters(Object.fromEntries(new URLSearchParams(search)));
  const result = await prisma.productQualityReview.updateMany({
    where: offQualityWhere(filters),
    data: { scanRequestedAt: new Date(), scanRequestedByAdminId: user.id, scanDoneAt: null, scanDoneByWorkerId: null },
  });
  revalidatePath(OFF_QUALITY_PATH);
  redirect(returnUrl(form, "sent", result.count));
}

// Tilbage fra scan-appen: varen står ikke længere som "skal scannes".
export async function withdrawFromScanApp(form: FormData) {
  await admin();
  const ids = selectedIds(form);
  if (ids.length === 0) redirect(returnUrl(form, "none"));
  const result = await prisma.productQualityReview.updateMany({
    where: { productId: { in: ids }, scanRequestedAt: { not: null }, scanDoneAt: null },
    data: { scanRequestedAt: null, scanRequestedByAdminId: null },
  });
  revalidatePath(OFF_QUALITY_PATH);
  redirect(returnUrl(form, "withdrawn", result.count));
}

// "Vurdér nu": samme kørsel som den natlige robot "off-quality".
export async function runAssessmentNow(form: FormData) {
  await admin();
  await assessOffProducts();
  revalidatePath(OFF_QUALITY_PATH);
  redirect(returnUrl(form, "assessed"));
}

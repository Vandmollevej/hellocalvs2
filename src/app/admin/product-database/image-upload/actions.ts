"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdminUser } from "@/lib/require-admin";
import {
  deleteProductImageUploads,
  resolveAllProductImageConflicts,
  resolveProductImageConflict,
} from "@/lib/product-image-upload";

// Handlinger på siden Billed-upload (docs/DECISIONS.md 2026-10-04): Ignorer /
// Erstat for billeder, der allerede findes, og sletning af enkelte filer eller
// et helt parti (tidligere billeder gendannes).

type Result = { ok: true; message?: string } | { ok: false; message: string };

const PATH = "/admin/product-database/images";
const NO_ACCESS = "Kun fuld admin-adgang kan ændre produktbilleder";

export async function resolveImageConflict(itemId: string, decision: "ignore" | "replace"): Promise<Result> {
  if (!(await requireFullAdminUser())) return { ok: false, message: NO_ACCESS };
  if (decision !== "ignore" && decision !== "replace") return { ok: false, message: "Ukendt valg" };
  const result = await resolveProductImageConflict(String(itemId), decision);
  revalidatePath(PATH);
  return result;
}

export async function resolveAllImageConflicts(decision: "ignore" | "replace"): Promise<Result> {
  if (!(await requireFullAdminUser())) return { ok: false, message: NO_ACCESS };
  if (decision !== "ignore" && decision !== "replace") return { ok: false, message: "Ukendt valg" };
  const { done, failed } = await resolveAllProductImageConflicts(decision);
  revalidatePath(PATH);
  const verb = decision === "replace" ? "erstattet" : "ignoreret";
  const message = `${done} ${done === 1 ? "billede" : "billeder"} ${verb}${failed > 0 ? `, ${failed} kunne ikke behandles` : ""}`;
  return failed === 0 ? { ok: true, message } : { ok: false, message };
}

export async function deleteImageUploadItems(itemIds: string[]): Promise<Result> {
  if (!(await requireFullAdminUser())) return { ok: false, message: NO_ACCESS };
  const ids = Array.isArray(itemIds) ? itemIds.map(String).slice(0, 5000) : [];
  if (ids.length === 0) return { ok: false, message: "Ingen billeder valgt" };
  const { deleted, restored } = await deleteProductImageUploads(ids);
  revalidatePath(PATH);
  return {
    ok: true,
    message: `${deleted} ${deleted === 1 ? "upload" : "uploads"} slettet${restored > 0 ? `, ${restored} ${restored === 1 ? "vare" : "varer"} fik det tidligere billede tilbage` : ""}`,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/require-admin";
import { decideProductRecheck } from "@/lib/product-recheck";

// Admin → Nye varer → 2-års tjek (docs/DECISIONS.md 2026-10-15): admin vælger
// billede og værdier, før det nye billede fritlægges.
export async function decideRecheckAction(
  recheckId: string,
  useNewImage: boolean,
  useNewData: boolean,
): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdminUser();
  if (!admin) return { ok: false, message: "Log ind som admin" };
  const ok = await decideProductRecheck({
    recheckId: String(recheckId),
    adminId: admin.id,
    useNewImage: Boolean(useNewImage),
    useNewData: Boolean(useNewData),
  });
  revalidatePath("/admin/products");
  return ok
    ? { ok, message: useNewImage ? "Gemt — det nye billede fritlægges i nat" : "Gemt" }
    : { ok, message: "Tjekket er allerede afgjort" };
}

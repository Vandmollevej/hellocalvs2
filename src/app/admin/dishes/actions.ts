"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Admin → Retter → HelloFresh/Valdemarsro (docs/DECISIONS.md 2026-10-07): det
// eneste, admin kan ændre på en importeret ret, er "Deaktivér" på linjen.
// Bruger Product.discontinued, som al søgning/AI-genkendelse allerede
// filtrerer på; HelloFresh-importen rører ikke feltet ved genimport.

export async function setDishDisabled(form: FormData) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const id = form.get("id");
  const path = form.get("path");
  if (typeof id !== "string" || !id) return;
  const disable = form.get("disable") === "1";
  await prisma.product.updateMany({
    where: { id, externalSource: "HELLOFRESH" },
    data: { discontinued: disable },
  });
  revalidatePath(typeof path === "string" && path.startsWith("/admin/dishes/") ? path : "/admin/dishes");
}

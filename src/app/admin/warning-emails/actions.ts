"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Personlig indstilling pr. administrator (docs/DECISIONS.md 2026-10-17).
export async function setWarningEmails(form: FormData) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  await prisma.user.update({ where: { id: admin.id }, data: { adminWarningEmails: form.get("enabled") === "on" } });
  revalidatePath("/admin/warning-emails");
}

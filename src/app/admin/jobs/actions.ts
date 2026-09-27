"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { setAgentJobStatus } from "@/lib/ai-agents";

// Server actions til admin "Jobs" (docs/DECISIONS.md 2026-09-27).

async function admin() {
  const user = await requireAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function closeJob(form: FormData) {
  await admin();
  const id = text(form, "id");
  if (!id) return;
  await setAgentJobStatus(id, "CLOSED");
  revalidatePath("/admin/jobs");
}

export async function reopenJob(form: FormData) {
  await admin();
  const id = text(form, "id");
  if (!id) return;
  await setAgentJobStatus(id, "OPEN");
  revalidatePath("/admin/jobs");
}

export async function deleteJob(form: FormData) {
  await admin();
  const id = text(form, "id");
  if (!id) return;
  await prisma.agentJob.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/jobs");
}

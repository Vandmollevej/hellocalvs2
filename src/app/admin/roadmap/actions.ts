"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { createRoadmapItem, isRoadmapStatus, setRoadmapStatus } from "@/lib/ai-agents";

// Server actions til admin "Roadmap" (docs/DECISIONS.md 2026-09-27).

async function admin() {
  const user = await requireAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function addRoadmapItem(form: FormData) {
  await admin();
  const title = text(form, "title").slice(0, 200);
  if (!title) redirect("/admin/roadmap?error=title");
  const status = text(form, "status");
  await createRoadmapItem({
    title,
    description: text(form, "description").slice(0, 4000) || null,
    status: isRoadmapStatus(status) ? status : "IDEA",
  });
  revalidatePath("/admin/roadmap");
}

export async function moveRoadmapItem(form: FormData) {
  await admin();
  const id = text(form, "id");
  const status = text(form, "status");
  if (!id || !isRoadmapStatus(status)) return;
  await setRoadmapStatus(id, status);
  revalidatePath("/admin/roadmap");
}

export async function deleteRoadmapItem(form: FormData) {
  await admin();
  const id = text(form, "id");
  if (!id) return;
  await prisma.roadmapItem.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/roadmap");
}

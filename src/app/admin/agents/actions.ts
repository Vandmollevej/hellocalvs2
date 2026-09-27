"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { AGENT_TOKEN_COOKIE, createAiAgent, rotateAiAgentToken } from "@/lib/ai-agents";

// Server actions til admin "Agenter" (docs/DECISIONS.md 2026-09-27). Hver
// action tjekker selv admin-sessionen — middleware alene er ikke nok.

async function admin() {
  const user = await requireAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Tokenet vises én gang for admin via en kortlivet httpOnly-cookie — aldrig
// i URL'en (samme mønster som scan-invites).
async function rememberToken(agentId: string, token: string) {
  const store = await cookies();
  store.set(AGENT_TOKEN_COOKIE, JSON.stringify({ agentId, token }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: 300,
  });
}

export async function createAgent(form: FormData) {
  await admin();
  const name = text(form, "name").slice(0, 80);
  if (!name) redirect("/admin/agents?error=name");
  const { agent, token } = await createAiAgent(name, text(form, "description").slice(0, 300) || null);
  await rememberToken(agent.id, token);
  revalidatePath("/admin/agents");
  redirect("/admin/agents");
}

export async function rotateAgentToken(form: FormData) {
  await admin();
  const id = text(form, "id");
  if (!id) return;
  const token = await rotateAiAgentToken(id);
  await rememberToken(id, token);
  revalidatePath("/admin/agents");
  redirect("/admin/agents");
}

export async function toggleAgent(form: FormData) {
  await admin();
  const id = text(form, "id");
  const agent = id ? await prisma.aiAgent.findUnique({ where: { id } }) : null;
  if (!agent) return;
  await prisma.aiAgent.update({ where: { id }, data: { disabled: !agent.disabled } });
  revalidatePath("/admin/agents");
}

export async function deleteAgent(form: FormData) {
  await admin();
  const id = text(form, "id");
  if (!id) return;
  await prisma.aiAgent.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/agents");
}

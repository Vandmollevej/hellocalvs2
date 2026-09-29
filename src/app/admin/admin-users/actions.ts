"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFullAdminUser } from "@/lib/require-admin";
import { isValidIpEntry, parseIpList } from "@/lib/admin-access";
import { ADMIN_INVITE_LINK_COOKIE, issueAdminInvite } from "@/lib/admin-invites";

// Server actions til Admin-brugere (docs/DECISIONS.md 2026-09-29). Kun fuld
// administratoradgang; middleware afviser desuden alle skrivninger fra
// læseadgang. En bruger kan ikke ændre sig selv (undgår at låse sig ude).

const PAGE = "/admin/admin-users";

async function fullAdmin() {
  const user = await requireFullAdminUser();
  if (!user) redirect("/admin");
  return user;
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Linket vises kun for den, der inviterede, i 5 minutter (httpOnly-cookie, aldrig i URL'en).
async function rememberInviteLink(link: string) {
  const store = await cookies();
  store.set(ADMIN_INVITE_LINK_COOKIE, link, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: PAGE,
    maxAge: 300,
  });
}

async function otherAdmin(me: { id: string }, userId: string) {
  if (!userId || userId === me.id) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user && user.role === "ADMIN" ? user : null;
}

export async function inviteAdmin(form: FormData) {
  const me = await fullAdmin();
  const name = text(form, "name");
  const email = text(form, "email").toLowerCase();
  const accessLevel = text(form, "accessLevel") === "FULL" ? "FULL" : "READ";
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`${PAGE}?error=invalid`);
  if (await prisma.user.findUnique({ where: { email } })) redirect(`${PAGE}?error=exists`);

  const result = await issueAdminInvite({ email, name, accessLevel, invitedById: me.id, inviterName: me.displayName });
  await rememberInviteLink(result.link);
  redirect(`${PAGE}?invite=${result.mailSent ? "sent" : "manual"}`);
}

export async function resendAdminInvite(form: FormData) {
  const me = await fullAdmin();
  const invite = await prisma.adminInvite.findUnique({ where: { id: text(form, "inviteId") } });
  if (!invite || invite.acceptedAt) redirect(PAGE);
  const result = await issueAdminInvite({
    email: invite.email,
    name: invite.name,
    accessLevel: invite.accessLevel,
    invitedById: me.id,
    inviterName: me.displayName,
  });
  await rememberInviteLink(result.link);
  redirect(`${PAGE}?invite=${result.mailSent ? "sent" : "manual"}`);
}

export async function revokeAdminInvite(form: FormData) {
  await fullAdmin();
  await prisma.adminInvite.updateMany({
    where: { id: text(form, "inviteId"), acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath(PAGE);
}

export async function setAdminAccessLevel(form: FormData) {
  const me = await fullAdmin();
  const user = await otherAdmin(me, text(form, "userId"));
  const level = text(form, "accessLevel");
  if (!user || (level !== "READ" && level !== "FULL")) return;
  // Sessioner udstedt før ændringen afvises, så det nye niveau gælder med det samme.
  await prisma.user.update({ where: { id: user.id }, data: { adminAccessLevel: level, adminSessionsValidFrom: new Date() } });
  revalidatePath(PAGE);
}

export async function setAdminDisabled(form: FormData) {
  const me = await fullAdmin();
  const user = await otherAdmin(me, text(form, "userId"));
  if (!user) return;
  const disable = text(form, "disable") === "1";
  await prisma.user.update({
    where: { id: user.id },
    data: { adminDisabledAt: disable ? new Date() : null, adminSessionsValidFrom: new Date() },
  });
  revalidatePath(PAGE);
}

export async function setAdminAllowedIps(form: FormData) {
  const me = await fullAdmin();
  const user = await otherAdmin(me, text(form, "userId"));
  if (!user) return;
  const entries = parseIpList(text(form, "ips"));
  if (entries.some((entry) => !isValidIpEntry(entry))) redirect(`${PAGE}?error=ip&user=${user.id}`);
  await prisma.user.update({
    where: { id: user.id },
    data: { adminAllowedIps: entries.length ? entries.join(", ") : null, adminSessionsValidFrom: new Date() },
  });
  revalidatePath(PAGE);
}

// "Log ud overalt": alle sessioner afvises og alle kendte enheder skal godkendes igen.
export async function signOutAdminEverywhere(form: FormData) {
  const me = await fullAdmin();
  const user = await otherAdmin(me, text(form, "userId"));
  if (!user) return;
  await prisma.$transaction([
    prisma.adminDevice.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { adminSessionsValidFrom: new Date() } }),
  ]);
  revalidatePath(PAGE);
}

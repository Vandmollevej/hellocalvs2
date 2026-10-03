"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFullAdminUser } from "@/lib/require-admin";
import { PARTNER_INVITE_LINK_COOKIE, issuePartnerInvite, resendPartnerInvite } from "@/lib/partner/invites";

// Server actions til Partnere → B2B-brugere (docs/DECISIONS.md 2026-10-02).
// KUN fuld administratoradgang kan oprette (invitere), gensende, deaktivere og
// slette B2B-brugere; middleware afviser desuden alle skrivninger fra
// læseadgang. Der findes ingen anden vej til en B2B-konto.

const PAGE = "/admin/partners/users";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
  store.set(PARTNER_INVITE_LINK_COOKIE, link, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: PAGE,
    maxAge: 300,
  });
}

export async function invitePartnerUser(form: FormData) {
  const me = await fullAdmin();
  const partnerId = text(form, "partnerId");
  const name = text(form, "name");
  const email = text(form, "email").toLowerCase();
  if (!partnerId || !name || !EMAIL_RE.test(email)) redirect(`${PAGE}?error=invalid`);

  const result = await issuePartnerInvite({ partnerId, name, email, invitedById: me.id, inviterName: me.displayName });
  if ("error" in result) redirect(`${PAGE}?error=${result.error}`);
  await rememberInviteLink(result.link);
  redirect(`${PAGE}?invite=${result.mailSent ? "sent" : "manual"}`);
}

export async function resendPartnerUserInvite(form: FormData) {
  const me = await fullAdmin();
  const result = await resendPartnerInvite(text(form, "userId"), me.id, me.displayName);
  if (!result || "error" in result) redirect(PAGE);
  await rememberInviteLink(result.link);
  redirect(`${PAGE}?invite=${result.mailSent ? "sent" : "manual"}`);
}

// Træk en ikke-accepteret invitation tilbage = slet rækken (der er ingen konto endnu).
export async function revokePartnerUserInvite(form: FormData) {
  await fullAdmin();
  await prisma.partnerUser.deleteMany({ where: { id: text(form, "userId"), acceptedAt: null } });
  revalidatePath(PAGE);
}

export async function setPartnerUserDisabled(form: FormData) {
  await fullAdmin();
  const disable = text(form, "disable") === "1";
  // Sessioner udstedt før ændringen afvises, så en deaktivering gælder med det samme.
  await prisma.partnerUser.updateMany({
    where: { id: text(form, "userId"), acceptedAt: { not: null } },
    data: { active: !disable, sessionsValidFrom: new Date() },
  });
  revalidatePath(PAGE);
}

export async function signOutPartnerUserEverywhere(form: FormData) {
  await fullAdmin();
  await prisma.partnerUser.updateMany({ where: { id: text(form, "userId") }, data: { sessionsValidFrom: new Date() } });
  revalidatePath(PAGE);
}

export async function deletePartnerUser(form: FormData) {
  await fullAdmin();
  await prisma.partnerUser.deleteMany({ where: { id: text(form, "userId") } });
  revalidatePath(PAGE);
}

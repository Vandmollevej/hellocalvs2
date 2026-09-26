"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { INVITE_LINK_COOKIE, issueScanInvite } from "@/lib/scan/invites";
import { encryptPii } from "@/lib/scan/pii";

// Server actions til admin "scan-invites" (docs/OPRETTELSES-APP.md). Hver
// action tjekker selv admin-sessionen — middleware alene er ikke nok.

async function admin() {
  const user = await requireAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}

// Opsætningslinket vises én gang for admin (til manuel videregivelse, hvis
// mailen ikke kan sendes) via en kortlivet httpOnly-cookie — aldrig i URL'en.
async function rememberInviteLink(link: string) {
  const store = await cookies();
  store.set(INVITE_LINK_COOKIE, link, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin/scan-invites",
    maxAge: 300,
  });
}

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function inviteWorker(form: FormData) {
  await admin();
  const name = text(form, "name");
  const email = text(form, "email").toLowerCase();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect("/admin/scan-invites?error=invalid");
  }
  const existing = await prisma.scanWorker.findUnique({ where: { email } });
  if (existing) redirect(`/admin/scan-invites/${existing.id}?error=exists`);

  const worker = await prisma.scanWorker.create({ data: { name, email } });
  const result = await issueScanInvite(worker.id);
  await rememberInviteLink(result.link);
  redirect(`/admin/scan-invites/${worker.id}?invite=${result.mailSent ? "sent" : "manual"}`);
}

export async function resendInvite(form: FormData) {
  await admin();
  const workerId = text(form, "workerId");
  const result = await issueScanInvite(workerId);
  await rememberInviteLink(result.link);
  redirect(`/admin/scan-invites/${workerId}?invite=${result.mailSent ? "sent" : "manual"}`);
}

export async function setWorkerStatus(form: FormData) {
  await admin();
  const workerId = text(form, "workerId");
  const status = text(form, "status");
  if (status !== "ACTIVE" && status !== "DISABLED") return;
  const worker = await prisma.scanWorker.findUnique({ where: { id: workerId } });
  // En inviteret, der endnu ikke har sat login op, kan ikke aktiveres manuelt.
  if (!worker || (status === "ACTIVE" && !worker.passwordHash)) return;
  await prisma.scanWorker.update({ where: { id: workerId }, data: { status } });
  revalidatePath(`/admin/scan-invites/${workerId}`);
}

// Profil + bank redigeres kun af admin; hver gemning versioneres.
export async function updateWorkerProfile(form: FormData) {
  const user = await admin();
  const workerId = text(form, "workerId");
  const birth = text(form, "birthDate");
  const current = await prisma.scanWorker.findUnique({ where: { id: workerId } });
  if (!current) return;

  // Tomme CPR/bank-felter betyder "uændret" (de vises aldrig i klartekst i
  // formularen); "slet" kræver det eksplicitte flueben.
  const cpr = text(form, "cpr");
  const regNo = text(form, "bankRegNo");
  const account = text(form, "bankAccount");
  const clear = form.get("clearSensitive") === "on";

  const data = {
    name: text(form, "name") || current.name,
    email: text(form, "email").toLowerCase() || current.email,
    phone: text(form, "phone") || null,
    address: text(form, "address") || null,
    gender: text(form, "gender") || null,
    birthDate: birth ? new Date(birth) : null,
    cprEnc: clear ? null : cpr ? encryptPii(cpr) : current.cprEnc,
    bankName: text(form, "bankName") || null,
    bankRegNoEnc: clear ? null : regNo ? encryptPii(regNo) : current.bankRegNoEnc,
    bankAccountEnc: clear ? null : account ? encryptPii(account) : current.bankAccountEnc,
    paypalEmail: text(form, "paypalEmail") || null,
  };

  await prisma.$transaction([
    prisma.scanWorker.update({ where: { id: workerId }, data }),
    prisma.scanWorkerProfileVersion.create({
      data: {
        workerId,
        changedByAdminId: user.id,
        snapshot: { ...data, birthDate: data.birthDate?.toISOString() ?? null },
      },
    }),
  ]);
  revalidatePath(`/admin/scan-invites/${workerId}`);
}

export async function reviewSubmission(form: FormData) {
  const user = await admin();
  const submissionId = text(form, "submissionId");
  const decision = text(form, "decision");
  const submission = await prisma.scanSubmission.findUnique({ where: { id: submissionId } });
  // Allerede udbetalte indsendelser kan ikke ændres (snapshot).
  if (!submission || submission.payoutId) return;

  if (decision === "accept") {
    await prisma.scanSubmission.update({
      where: { id: submissionId },
      data: {
        reviewStatus: "ACCEPTED",
        rejectionReasonId: null,
        rejectionComment: null,
        reviewedAt: new Date(),
        reviewedByAdminId: user.id,
      },
    });
  } else if (decision === "reject") {
    const reasonId = text(form, "reasonId") || null;
    await prisma.scanSubmission.update({
      where: { id: submissionId },
      data: {
        reviewStatus: "REJECTED",
        rejectionReasonId: reasonId,
        rejectionComment: text(form, "comment") || null,
        reviewedAt: new Date(),
        reviewedByAdminId: user.id,
      },
    });
  }
  revalidatePath(`/admin/scan-invites/${submission.workerId}`);
}

// Registrerer en udbetaling af alle accepterede, ikke-afregnede, betalbare
// indsendelser. Selve pengeoverførslen sker (endnu) uden for systemet.
export async function registerPayout(form: FormData) {
  await admin();
  const workerId = text(form, "workerId");
  const due = await prisma.scanSubmission.findMany({
    where: { workerId, reviewStatus: "ACCEPTED", payable: true, payoutId: null },
    select: { id: true, amountOre: true },
  });
  if (!due.length) return;
  const amountOre = due.reduce((sum, row) => sum + row.amountOre, 0);
  await prisma.scanPayout.create({
    data: {
      workerId,
      amountOre,
      note: text(form, "note") || null,
      submissions: { connect: due.map((row) => ({ id: row.id })) },
    },
  });
  revalidatePath(`/admin/scan-invites/${workerId}`);
}

export async function sendAdminMessage(form: FormData) {
  await admin();
  const workerId = text(form, "workerId");
  const body = text(form, "body").slice(0, 4000);
  if (!body) return;
  await prisma.scanMessage.create({ data: { workerId, body, fromAdmin: true } });
  await prisma.scanMessage.updateMany({ where: { workerId, fromAdmin: false, readAt: null }, data: { readAt: new Date() } });
  revalidatePath(`/admin/scan-invites/${workerId}`);
}

export async function updatePayRate(form: FormData) {
  await admin();
  const kroner = Number(text(form, "kroner").replace(",", "."));
  if (!Number.isFinite(kroner) || kroner < 0 || kroner > 1000) return;
  const payPerItemOre = Math.round(kroner * 100);
  await prisma.scanSettings.upsert({ where: { id: 1 }, update: { payPerItemOre }, create: { id: 1, payPerItemOre } });
  revalidatePath("/admin/scan-invites");
}

export async function saveRejectionReason(form: FormData) {
  await admin();
  const id = text(form, "id");
  const label = text(form, "label").slice(0, 120);
  const active = form.get("active") === "on";
  if (id) {
    await prisma.scanRejectionReason.update({ where: { id }, data: { label: label || undefined, active } });
  } else if (label) {
    const last = await prisma.scanRejectionReason.aggregate({ _max: { sortOrder: true } });
    await prisma.scanRejectionReason.create({ data: { label, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  }
  revalidatePath("/admin/scan-invites");
}

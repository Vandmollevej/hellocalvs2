// Server-only: familieopsætning (docs/FAMILY.md). Betaleren (Family.ownerId)
// bestemmer alt: hvem er med, hvem er barn, og hvem der må se og taste ind for
// hvem. Kun betalt — en familie kræver et aktivt familieabonnement.

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Sex } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeAge } from "@/lib/age";
import { getSubscriptionTier } from "@/lib/subscription";

export const MAX_FAMILY_PROFILES = 6;
// Under denne alder kan man ikke selv oprette en konto eller melde sig ud af
// familien (databeskyttelsesloven § 6, stk. 2, se docs/FAMILY.md).
export const FAMILY_SELF_CONSENT_AGE = 15;
const CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class FamilyError extends Error {
  constructor(
    public code: string,
    public status = 400
  ) {
    super(code);
  }
}

export function hashFamilyCode(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase().replace(/[\s-]/g, "")).digest("hex");
}

// 8 tegn uden tvetydige bogstaver/tal (0/O, 1/I), vist som XXXX-XXXX.
function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function hasActiveFamilyPlan(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  return Boolean(subscription && subscription.plan === "FAMILY" && getSubscriptionTier(subscription) === "SERIOUS");
}

export async function getFamilyOverview(userId: string) {
  const membership = await prisma.familyMember.findUnique({ where: { userId }, select: { familyId: true } });
  if (!membership) return null;
  const family = await prisma.family.findUnique({
    where: { id: membership.familyId },
    include: {
      owner: { select: { id: true, displayName: true } },
      members: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, displayName: true, birthDate: true, passwordHash: true, oauthAccounts: { select: { id: true } } } },
        },
      },
      grants: { select: { granteeId: true, subjectId: true } },
    },
  });
  if (!family) return null;
  return {
    id: family.id,
    ownerId: family.ownerId,
    ownerName: family.owner.displayName,
    isOwner: family.ownerId === userId,
    members: family.members.map((member) => ({
      userId: member.userId,
      displayName: member.user.displayName,
      isChild: member.isChild,
      age: computeAge(member.user.birthDate),
      hasLogin: Boolean(member.user.passwordHash) || member.user.oauthAccounts.length > 0,
      createdByOwner: member.createdById === family.ownerId,
    })),
    grants: family.grants,
  };
}

// Hvem kan se og taste ind på userId's profil (til Kontrol-loggen).
export async function listWhoHasAccess(userId: string) {
  const membership = await prisma.familyMember.findUnique({
    where: { userId },
    select: { family: { select: { ownerId: true, owner: { select: { displayName: true } } } } },
  });
  if (!membership) return [];
  const grants = await prisma.familyAccessGrant.findMany({
    where: { subjectId: userId },
    select: { grantee: { select: { id: true, displayName: true } } },
  });
  const people = [{ id: membership.family.ownerId, displayName: membership.family.owner.displayName, isOwner: true }];
  for (const grant of grants) {
    if (grant.grantee.id !== membership.family.ownerId) {
      people.push({ id: grant.grantee.id, displayName: grant.grantee.displayName, isOwner: false });
    }
  }
  return people.filter((person) => person.id !== userId);
}

export async function createFamily(ownerId: string) {
  if (!(await hasActiveFamilyPlan(ownerId))) throw new FamilyError("familyPlanRequired", 402);
  const existing = await prisma.familyMember.findUnique({ where: { userId: ownerId } });
  if (existing) throw new FamilyError("alreadyInFamily", 409);
  return prisma.family.create({
    data: { ownerId, members: { create: { userId: ownerId, isChild: false } } },
  });
}

async function requireOwnedFamily(ownerId: string) {
  const family = await prisma.family.findUnique({ where: { ownerId }, include: { members: true } });
  if (!family) throw new FamilyError("notOwner", 403);
  if (!(await hasActiveFamilyPlan(ownerId))) throw new FamilyError("familyPlanRequired", 402);
  return family;
}

export async function createFamilyProfile(
  ownerId: string,
  input: { displayName: string; birthDate: Date | null; sex: Sex | null; isChild: boolean; heightCm: number | null; weightKg: number | null }
) {
  const family = await requireOwnedFamily(ownerId);
  if (family.members.length >= MAX_FAMILY_PROFILES) throw new FamilyError("familyFull", 409);
  if (!input.displayName.trim()) throw new FamilyError("nameRequired");

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        // Samme pladsholder som konti uden e-mail (migration
        // 20260925090000_restore_normal_accounts). Kan ikke logge ind, før
        // profilen får en rigtig e-mail via en engangskode.
        email: `no-email+family-${randomUUID()}@invalid.hellocal`,
        displayName: input.displayName.trim(),
        birthDate: input.birthDate,
        sex: input.sex,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        startWeightUpdatedAt: input.weightKg !== null ? new Date() : null,
        onboardingCompletedAt: new Date(),
        // Familieprofiler får aldrig reklamer eller partnertilbud.
        wantsPartnerOffersEmails: false,
      },
    });
    await tx.familyMember.create({
      data: { familyId: family.id, userId: user.id, isChild: input.isChild, createdById: ownerId },
    });
    return user;
  });
}

export async function setMemberIsChild(ownerId: string, memberUserId: string, isChild: boolean) {
  const family = await requireOwnedFamily(ownerId);
  if (memberUserId === ownerId) throw new FamilyError("notAllowed");
  const member = family.members.find((m) => m.userId === memberUserId);
  if (!member) throw new FamilyError("notMember", 404);
  await prisma.familyMember.update({ where: { id: member.id }, data: { isChild } });
}

export async function setAccessGrant(ownerId: string, granteeId: string, subjectId: string, allowed: boolean) {
  const family = await requireOwnedFamily(ownerId);
  const memberIds = new Set(family.members.map((m) => m.userId));
  if (!memberIds.has(granteeId) || !memberIds.has(subjectId)) throw new FamilyError("notMember", 404);
  if (granteeId === subjectId || granteeId === ownerId) throw new FamilyError("notAllowed");
  if (allowed) {
    await prisma.familyAccessGrant.upsert({
      where: { granteeId_subjectId: { granteeId, subjectId } },
      create: { familyId: family.id, granteeId, subjectId },
      update: {},
    });
  } else {
    await prisma.familyAccessGrant.deleteMany({ where: { granteeId, subjectId } });
  }
}

// Kode til at sætte login på en profil uden login (profileId), eller til at
// koble en eksisterende bruger på familien (uden profileId). Returnerer koden
// i klartekst én gang; kun hashen gemmes.
export async function createFamilyCode(ownerId: string, profileId: string | null) {
  const family = await requireOwnedFamily(ownerId);
  if (profileId) {
    if (!family.members.some((m) => m.userId === profileId) || profileId === ownerId) {
      throw new FamilyError("notMember", 404);
    }
  } else if (family.members.length >= MAX_FAMILY_PROFILES) {
    throw new FamilyError("familyFull", 409);
  }
  const code = newCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await prisma.familyLoginCode.create({
    data: { familyId: family.id, profileId, codeHash: hashFamilyCode(code), expiresAt },
  });
  return { code, expiresAt };
}

async function findUsableCode(code: string) {
  const row = await prisma.familyLoginCode.findUnique({ where: { codeHash: hashFamilyCode(code) } });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) throw new FamilyError("invalidCode", 404);
  return row;
}

// Et familiemedlem uden login sætter e-mail og adgangskode på sin profil.
export async function claimFamilyProfile(code: string, email: string, passwordHash: string) {
  const row = await findUsableCode(code);
  if (!row.profileId) throw new FamilyError("invalidCode", 404);
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) throw new FamilyError("emailTaken", 409);
  const profileId = row.profileId;
  return prisma.$transaction(async (tx) => {
    await tx.familyLoginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return tx.user.update({
      where: { id: profileId },
      data: { email, passwordHash, emailVerifiedAt: new Date() },
    });
  });
}

// En eksisterende bruger siger ja til at blive koblet på en familie. Fra da
// af bestemmer betaleren over profilen (docs/FAMILY.md punkt 2).
export async function joinFamily(userId: string, code: string) {
  const row = await findUsableCode(code);
  if (row.profileId) throw new FamilyError("invalidCode", 404);
  const existing = await prisma.familyMember.findUnique({ where: { userId } });
  if (existing) throw new FamilyError("alreadyInFamily", 409);
  const count = await prisma.familyMember.count({ where: { familyId: row.familyId } });
  if (count >= MAX_FAMILY_PROFILES) throw new FamilyError("familyFull", 409);
  await prisma.$transaction([
    prisma.familyLoginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.familyMember.create({ data: { familyId: row.familyId, userId, isChild: false } }),
  ]);
}

async function detachMember(familyId: string, userId: string) {
  await prisma.$transaction([
    prisma.familyAccessGrant.deleteMany({ where: { familyId, OR: [{ granteeId: userId }, { subjectId: userId }] } }),
    prisma.familyLoginCode.deleteMany({ where: { familyId, profileId: userId, usedAt: null } }),
    prisma.familyMember.delete({ where: { userId } }),
  ]);
}

// Medlemmet låser de andre ude. Kræver eget login og — for børn — at barnet
// er fyldt 15 (docs/FAMILY.md, fortolkning af punkt 3 + 4).
export async function leaveFamily(userId: string) {
  const member = await prisma.familyMember.findUnique({
    where: { userId },
    include: { family: true, user: { select: { birthDate: true, passwordHash: true, oauthAccounts: { select: { id: true } } } } },
  });
  if (!member) throw new FamilyError("notMember", 404);
  if (member.family.ownerId === userId) throw new FamilyError("ownerCannotLeave");
  const hasLogin = Boolean(member.user.passwordHash) || member.user.oauthAccounts.length > 0;
  if (!hasLogin) throw new FamilyError("notAllowed", 403);
  const age = computeAge(member.user.birthDate);
  if (member.isChild && (age === null || age < FAMILY_SELF_CONSENT_AGE)) throw new FamilyError("tooYoungToLeave", 403);
  await detachMember(member.familyId, userId);
}

// Betaleren fjerner et medlem, der har sit eget login (det bliver en
// almindelig, selvstændig konto). Profiler uden login kan ikke fjernes endnu.
export async function removeFamilyMember(ownerId: string, memberUserId: string) {
  const family = await requireOwnedFamily(ownerId);
  if (memberUserId === ownerId) throw new FamilyError("notAllowed");
  if (!family.members.some((m) => m.userId === memberUserId)) throw new FamilyError("notMember", 404);
  const user = await prisma.user.findUnique({
    where: { id: memberUserId },
    select: { passwordHash: true, oauthAccounts: { select: { id: true } } },
  });
  if (!user?.passwordHash && !user?.oauthAccounts.length) throw new FamilyError("profileWithoutLogin", 409);
  await detachMember(family.id, memberUserId);
}

// Server-only: familieopsætning (docs/FAMILY.md). Betaleren (Family.ownerId)
// bestemmer alt: hvem er med, hvem er barn, og hvem der må se og taste ind for
// hvem. Kun betalt — en familie kræver et aktivt familieabonnement.

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma, type Sex } from "@prisma/client";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { createInviteToken, decryptFamilyValue, encryptFamilyValue, inviteUrl, readInviteToken } from "@/lib/family-invite-token";
import { computeAge } from "@/lib/age";
import { FAMILY_SELF_CONSENT_AGE, sharingDeciderId } from "@/lib/family-sharing";
import { getSubscriptionTier } from "@/lib/subscription";
import { queueMessage } from "@/lib/messaging";

export const MAX_FAMILY_PROFILES = 5;
// Højst så mange ekstra pladser kan tilkøbes ud over de 5 (ejerens valg
// 2026-10-03: "0/5 ekstra tilkøb"). Selve købet er ikke bygget endnu.
export const MAX_EXTRA_SEATS = 5;
// Under denne alder kan man ikke selv oprette en konto eller melde sig ud af
// familien (databeskyttelsesloven § 6, stk. 2, se docs/FAMILY.md).
export { FAMILY_SELF_CONSENT_AGE };
const CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class FamilyError extends Error {
  constructor(
    public code: string,
    public status = 400
  ) {
    super(code);
  }
}

export function familyCapacity(extraSeats: number) {
  return MAX_FAMILY_PROFILES + Math.min(Math.max(extraSeats, 0), MAX_EXTRA_SEATS);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
  const [subscription, user] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  // Administratorer har altid familieabonnement, så alle felter kan testes (docs/DECISIONS.md 2026-10-02).
  if (user?.role === "ADMIN") return true;
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
    extraSeats: family.extraSeats,
    maxExtraSeats: MAX_EXTRA_SEATS,
    capacity: familyCapacity(family.extraSeats),
    members: family.members.map((member) => {
      const age = computeAge(member.user.birthDate);
      const hasLogin = Boolean(member.user.passwordHash) || member.user.oauthAccounts.length > 0;
      return {
        userId: member.userId,
        displayName: member.user.displayName,
        isChild: member.isChild,
        age,
        hasLogin,
        createdByOwner: member.createdById === family.ownerId,
        // Den, der styrer medlemmets sletteret: profilens opretter, ellers betaleren.
        controllerId: member.createdById ?? family.ownerId,
        canDeleteOthersEntries: member.canDeleteOthersEntries,
        // Den, der bestemmer, hvem andre i familien må se profilen.
        sharingDeciderId: sharingDeciderId(
          { userId: member.userId, hasLogin, isChild: member.isChild, age },
          family.ownerId
        ),
      };
    }),
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

// Betalerens familie — oprettes, hvis den ikke findes endnu, så "Inviter
// familiemedlem" og "Tilføj barn" virker uden et ekstra "Opret familie"-trin.
async function ensureOwnedFamily(ownerId: string) {
  const existing = await prisma.family.findUnique({ where: { ownerId }, select: { id: true } });
  if (!existing) await createFamily(ownerId);
  return requireOwnedFamily(ownerId);
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
  const family = await ensureOwnedFamily(ownerId);
  if (family.members.length >= familyCapacity(family.extraSeats)) throw new FamilyError("familyFull", 409);
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
      data: {
        familyId: family.id,
        userId: user.id,
        isChild: input.isChild,
        createdById: ownerId,
        // Børn kan som udgangspunkt ikke slette det, andre har tastet ind.
        canDeleteOthersEntries: !input.isChild,
      },
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

// Må medlemmet slette registreringer, som andre har tastet ind? Kun den, der
// oprettede profilen (ellers betaleren), kan ændre det.
export async function setMemberDeletePermission(actorId: string, memberUserId: string, allowed: boolean) {
  const member = await prisma.familyMember.findUnique({
    where: { userId: memberUserId },
    include: { family: { select: { ownerId: true } } },
  });
  if (!member) throw new FamilyError("notMember", 404);
  const controllerId = member.createdById ?? member.family.ownerId;
  if (controllerId !== actorId || memberUserId === actorId) throw new FamilyError("notAllowed", 403);
  await prisma.familyMember.update({ where: { id: member.id }, data: { canDeleteOthersEntries: allowed } });
}

// Hvem bestemmer over hver profils deling (sharingDeciderId), for familiens
// medlemmer. Bruges, når der gives eller fjernes adgang.
async function sharingDeciders(familyId: string, ownerId: string) {
  const members = await prisma.familyMember.findMany({
    where: { familyId },
    select: {
      userId: true,
      isChild: true,
      user: { select: { birthDate: true, passwordHash: true, oauthAccounts: { select: { id: true } } } },
    },
  });
  return new Map(
    members.map((member) => [
      member.userId,
      sharingDeciderId(
        {
          userId: member.userId,
          isChild: member.isChild,
          age: computeAge(member.user.birthDate),
          hasLogin: Boolean(member.user.passwordHash) || member.user.oauthAccounts.length > 0,
        },
        ownerId
      ),
    ])
  );
}

// Giver/fjerner granteeId's adgang til subjectId's profil. Kun den, der
// bestemmer over profilen, må: personen selv (voksne med eget login), ellers
// betaleren (ejerens beslutning 2026-10-03). Betaleren har altid adgang.
export async function setAccessGrant(actorId: string, granteeId: string, subjectId: string, allowed: boolean) {
  const membership = await prisma.familyMember.findUnique({
    where: { userId: actorId },
    select: { family: { select: { id: true, ownerId: true } } },
  });
  if (!membership) throw new FamilyError("notMember", 404);
  const family = membership.family;
  const deciders = await sharingDeciders(family.id, family.ownerId);
  if (!deciders.has(granteeId) || !deciders.has(subjectId)) throw new FamilyError("notMember", 404);
  if (granteeId === subjectId || granteeId === family.ownerId) throw new FamilyError("notAllowed");
  if (deciders.get(subjectId) !== actorId) throw new FamilyError("notAllowed", 403);
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
// koble en eksisterende bruger på familien (uden profileId). Koden er bundet
// til den e-mail, betaleren skriver: den virker kun sammen med præcis den
// e-mail (ejerens krav 2026-10-03). Kun hashen bruges til opslag; koden
// gemmes også krypteret, så betaleren kan se kode og QR-kode igen.
export async function createFamilyCode(ownerId: string, profileId: string | null, rawEmail: string) {
  const family = await requireOwnedFamily(ownerId);
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) throw new FamilyError("invalidEmail");
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, familyMembership: { select: { familyId: true } } },
  });
  if (profileId) {
    if (!family.members.some((m) => m.userId === profileId) || profileId === ownerId) {
      throw new FamilyError("notMember", 404);
    }
    // Profilen skal have en e-mail, ingen anden konto bruger.
    if (existingUser) throw new FamilyError("emailTaken", 409);
  } else {
    if (family.members.length >= familyCapacity(family.extraSeats)) throw new FamilyError("familyFull", 409);
    if (existingUser?.familyMembership) {
      throw new FamilyError(existingUser.familyMembership.familyId === family.id ? "alreadyMember" : "inOtherFamily", 409);
    }
  }

  // En ny kode til samme person erstatter den gamle.
  await prisma.familyLoginCode.deleteMany({ where: { familyId: family.id, profileId, email, usedAt: null } });

  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  // codeHash er unik i databasen; ved det usandsynlige sammenfald laves en ny.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newCode();
    try {
      await prisma.familyLoginCode.create({
        data: {
          familyId: family.id,
          profileId,
          email,
          codeHash: hashFamilyCode(code),
          codeCipher: encryptFamilyValue(code),
          expiresAt,
        },
      });
      return { code, email, expiresAt };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new FamilyError("unknown", 500);
}

// Betalerens ventende koder med kode, link og QR-kode (vises på
// familiesiden, indtil koden er brugt, udløbet eller trukket tilbage).
export async function listPendingFamilyCodes(ownerId: string) {
  const family = await prisma.family.findUnique({ where: { ownerId }, select: { id: true } });
  if (!family) throw new FamilyError("notOwner", 403);
  const rows = await prisma.familyLoginCode.findMany({
    where: { familyId: family.id, usedAt: null, expiresAt: { gt: new Date() }, email: { not: null }, codeCipher: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, profileId: true, email: true, inviteeName: true, codeCipher: true, expiresAt: true },
  });
  const result = [];
  for (const row of rows) {
    const code = decryptFamilyValue(row.codeCipher!);
    if (!code) continue;
    const url = inviteUrl(createInviteToken(code, row.email!), row.profileId ? "claim" : "join");
    result.push({
      id: row.id,
      profileId: row.profileId,
      email: row.email!,
      name: row.inviteeName,
      code,
      expiresAt: row.expiresAt,
      url,
      qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }),
    });
  }
  return result;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// "Inviter familiemedlem" (docs/FAMILY.md 2026-10-03): en kode bundet til
// personens e-mail, som også husker navnet og de profiler, personen får
// indsigt i. Personen får en mail med det krypterede tilknytningslink og
// siger selv ja (joinFamily opretter så adgangen til de valgte profiler).
export async function createFamilyInvitation(
  ownerId: string,
  input: { name: string; email: string; subjectIds: string[] }
) {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new FamilyError("nameRequired");
  const family = await ensureOwnedFamily(ownerId);
  const { code, email, expiresAt } = await createFamilyCode(ownerId, null, input.email);

  // Betaleren kan kun give indsigt i profiler, betaleren selv bestemmer over
  // (sin egen, profiler uden eget login og børn under 15).
  const deciders = await sharingDeciders(family.id, ownerId);
  const subjectIds = [...new Set(input.subjectIds)].filter((id) => deciders.get(id) === ownerId);
  await prisma.familyLoginCode.update({
    where: { codeHash: hashFamilyCode(code) },
    data: { inviteeName: name, grantSubjectIds: subjectIds },
  });

  const [owner, subjects] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerId }, select: { displayName: true } }),
    prisma.user.findMany({ where: { id: { in: subjectIds } }, select: { displayName: true } }),
  ]);
  await queueMessage("FAMILY_INVITATION", {
    toEmail: email,
    vars: {
      ownerName: escapeHtml(owner?.displayName || "Et familiemedlem"),
      inviteeName: escapeHtml(name),
      profiles: subjects.length > 0 ? escapeHtml(subjects.map((subject) => subject.displayName).join(", ")) : "ingen endnu",
      code,
      inviteUrl: inviteUrl(createInviteToken(code, email), "join"),
    },
  });
  return { email, expiresAt };
}

export async function revokeFamilyCode(ownerId: string, codeId: string) {
  const family = await prisma.family.findUnique({ where: { ownerId }, select: { id: true } });
  if (!family) throw new FamilyError("notOwner", 403);
  const { count } = await prisma.familyLoginCode.deleteMany({ where: { id: codeId, familyId: family.id, usedAt: null } });
  if (!count) throw new FamilyError("notFound", 404);
}

// Kode + e-mail skrevet af personen, eller begge læst fra en QR-kode.
export type FamilyCodeInput = { code: string; email: string } | { token: string };

function resolveCodeInput(input: FamilyCodeInput) {
  if ("token" in input) {
    const parsed = readInviteToken(input.token);
    if (!parsed) throw new FamilyError("invalidCode", 404);
    return parsed;
  }
  return input;
}

// Koden og e-mailen skal passe sammen. Samme fejl uanset hvad der er galt, så
// man ikke kan gætte sig frem til, om en kode findes.
async function findUsableCode(input: FamilyCodeInput) {
  const { code, email } = resolveCodeInput(input);
  const row = await prisma.familyLoginCode.findUnique({ where: { codeHash: hashFamilyCode(code) } });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) throw new FamilyError("invalidCode", 404);
  if (!row.email || row.email !== normalizeEmail(email)) throw new FamilyError("invalidCode", 404);
  return { ...row, email: row.email };
}

// Til tilknytningssiden: hvem inviterer, og til hvilken e-mail.
export async function previewFamilyInvite(token: string) {
  const row = await findUsableCode({ token });
  const [family, subjects] = await Promise.all([
    prisma.family.findUnique({
      where: { id: row.familyId },
      select: { owner: { select: { displayName: true } } },
    }),
    prisma.user.findMany({
      where: { id: { in: row.grantSubjectIds }, forgottenAt: null },
      select: { displayName: true },
    }),
  ]);
  return {
    kind: row.profileId ? ("claim" as const) : ("join" as const),
    ownerName: family?.owner.displayName ?? "",
    inviteeName: row.inviteeName ?? "",
    email: row.email,
    expiresAt: row.expiresAt,
    // Profiler, personen får indsigt i ved at sige ja ("Inviter familiemedlem").
    profiles: subjects.map((subject) => subject.displayName),
  };
}

// Indtastet kode + e-mail fra tilmeldings-/familiekodesiden: giver samme
// krypterede token som QR-koden, så begge veje fortsætter i samme flow.
export async function resolveFamilyCode(code: string, email: string) {
  const row = await findUsableCode({ code, email });
  return { kind: row.profileId ? ("claim" as const) : ("join" as const), token: createInviteToken(code, row.email) };
}

// Et familiemedlem uden login sætter e-mail og adgangskode på sin profil. Den
// e-mail, der skrives, skal være den, betaleren lavede koden til.
export async function claimFamilyProfile(input: FamilyCodeInput, passwordHash: string) {
  const row = await findUsableCode(input);
  if (!row.profileId) throw new FamilyError("invalidCode", 404);
  const taken = await prisma.user.findUnique({ where: { email: row.email }, select: { id: true } });
  if (taken) throw new FamilyError("emailTaken", 409);
  const profileId = row.profileId;
  return prisma.$transaction(async (tx) => {
    await tx.familyLoginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return tx.user.update({
      where: { id: profileId },
      data: { email: row.email, passwordHash, emailVerifiedAt: new Date() },
    });
  });
}

// En eksisterende bruger siger ja til at blive koblet på en familie. Koden
// virker kun, når den indloggede kontos e-mail er den, koden blev lavet til.
// Fra da af bestemmer betaleren over profilen (docs/FAMILY.md punkt 2).
export async function joinFamily(userId: string, input: FamilyCodeInput) {
  const row = await findUsableCode(input);
  if (row.profileId) throw new FamilyError("invalidCode", 404);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user || normalizeEmail(user.email) !== row.email) throw new FamilyError("emailMismatch", 403);
  const existing = await prisma.familyMember.findUnique({ where: { userId } });
  if (existing) throw new FamilyError("alreadyInFamily", 409);
  const family = await prisma.family.findUnique({
    where: { id: row.familyId },
    select: { extraSeats: true, members: { select: { userId: true } } },
  });
  if (!family || family.members.length >= familyCapacity(family.extraSeats)) throw new FamilyError("familyFull", 409);
  // Invitationer giver indsigt i de profiler, betaleren valgte — kun dem, der
  // stadig er med i familien, og som betaleren stadig bestemmer over.
  const owner = await prisma.family.findUnique({ where: { id: row.familyId }, select: { ownerId: true } });
  const deciders = owner ? await sharingDeciders(row.familyId, owner.ownerId) : new Map<string, string>();
  const subjectIds = row.grantSubjectIds.filter((id) => id !== userId && deciders.get(id) === owner?.ownerId);
  await prisma.$transaction([
    prisma.familyLoginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.familyMember.create({ data: { familyId: row.familyId, userId, isChild: false } }),
    ...subjectIds.map((subjectId) =>
      prisma.familyAccessGrant.create({ data: { familyId: row.familyId, granteeId: userId, subjectId } })
    ),
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

// Betaleren sletter en profil uden eget login, fx et barns (brugerens valg
// 2026-09-26: "slet alt"). Alle dagbogsdata slettes; selve User-rækken
// anonymiseres som ved kontosletning (src/lib/gdpr.ts), fordi andre tabeller
// kan pege på den. Kræver, at man har skrevet SLET i klienten.
export async function deleteFamilyProfile(ownerId: string, profileId: string) {
  const family = await prisma.family.findUnique({ where: { ownerId }, include: { members: true } });
  if (!family) throw new FamilyError("notOwner", 403);
  if (profileId === ownerId || !family.members.some((m) => m.userId === profileId)) {
    throw new FamilyError("notMember", 404);
  }
  const user = await prisma.user.findUnique({
    where: { id: profileId },
    select: { passwordHash: true, oauthAccounts: { select: { id: true } } },
  });
  if (user?.passwordHash || user?.oauthAccounts.length) throw new FamilyError("profileHasLogin", 409);

  const where = { userId: profileId };
  await prisma.$transaction([
    prisma.registration.deleteMany({ where }),
    prisma.weightEntry.deleteMany({ where }),
    prisma.bodyMeasurement.deleteMany({ where }),
    prisma.goal.deleteMany({ where }),
    prisma.waterEntry.deleteMany({ where }),
    prisma.menstrualCycleEntry.deleteMany({ where }),
    prisma.sleepSchedule.deleteMany({ where }),
    prisma.workShift.deleteMany({ where }),
    prisma.activity.deleteMany({ where }),
    prisma.healthMetric.deleteMany({ where }),
    prisma.favorite.deleteMany({ where }),
    prisma.sharedRecipeFavorite.deleteMany({ where }),
    prisma.notificationPreference.deleteMany({ where }),
    prisma.userProductSearchHistory.deleteMany({ where }),
    prisma.familyAccessGrant.deleteMany({ where: { OR: [{ granteeId: profileId }, { subjectId: profileId }] } }),
    prisma.familyLoginCode.deleteMany({ where: { profileId } }),
    prisma.profileAccessLog.deleteMany({ where: { subjectId: profileId } }),
    prisma.familyMember.delete({ where: { userId: profileId } }),
    prisma.user.update({
      where: { id: profileId },
      data: {
        email: `slettet-${profileId}@hellocal.invalid`,
        displayName: "Slettet bruger",
        phone: null,
        phoneVerifiedAt: null,
        weightKg: null,
        heightCm: null,
        birthDate: null,
        sex: null,
        targetWeightKg: null,
        forgottenAt: new Date(),
      },
    }),
  ]);
}

// Betalerens konto slettes: familien opløses, og hvert medlem beholder sine
// egne data (brugerens valg 2026-09-26). Profiler uden eget login ligger
// fortsat med deres data, men kan ikke åbnes af nogen, før support hjælper.
export async function dissolveFamilyOf(userId: string) {
  const family = await prisma.family.findUnique({ where: { ownerId: userId }, select: { id: true } });
  if (family) {
    // Medlemmer, tildelinger og koder følger med (onDelete: Cascade).
    await prisma.family.delete({ where: { id: family.id } });
    return;
  }
  const member = await prisma.familyMember.findUnique({ where: { userId }, select: { familyId: true } });
  if (member) await detachMember(member.familyId, userId);
}

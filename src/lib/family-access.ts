// Server-only: hvem må se og taste ind på hvilken profil, og loggen over det
// (docs/FAMILY.md, docs/DECISIONS.md 2026-09-25 "Familieabonnement").
//
// Den indloggede bruger vælger en aktiv profil (cookien hc_active_profile).
// Kun dagbogsdata følger den aktive profil — de ruter kalder getProfileUser()
// i stedet for getSessionUser(). Login, adgangskode, abonnement,
// integrationer og familieopsætning bruger altid getSessionUser().

import { cookies } from "next/headers";
import type { ProfileAccessAction, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const ACTIVE_PROFILE_COOKIE = "hc_active_profile";

// En "set"-hændelse for samme person, profil og område logges højst én gang
// pr. 10 minutter, så loggen ikke fyldes af hver eneste skærmopdatering.
const VIEW_DEDUPE_MS = 10 * 60 * 1000;

// Så længe der er en hændelse fra en anden person inden for dette vindue,
// vises den blå ramme og telefonikonet på profilen.
export const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

export type ProfileArea =
  | "profile"
  | "registrations"
  | "water"
  | "weight"
  | "activities"
  | "bodyMeasurements"
  | "goals"
  | "healthMetrics"
  | "menstrualCycle"
  | "sleep"
  | "workShifts"
  | "favorites"
  | "recipeFavorites"
  | "login";

// Må actorId se og taste ind for subjectId? Betaleren har adgang til alle
// familiens profiler; andre kun via en FamilyAccessGrant fra betaleren.
export async function canActFor(actorId: string, subjectId: string): Promise<boolean> {
  if (actorId === subjectId) return true;
  const membership = await prisma.familyMember.findUnique({
    where: { userId: subjectId },
    select: { familyId: true, family: { select: { ownerId: true } } },
  });
  if (!membership) return false;
  if (membership.family.ownerId === actorId) return true;
  const grant = await prisma.familyAccessGrant.findUnique({
    where: { granteeId_subjectId: { granteeId: actorId, subjectId } },
    select: { familyId: true },
  });
  return grant?.familyId === membership.familyId;
}

// Profiler, den indloggede bruger kan skifte til (inkl. sig selv først).
export async function listAccessibleProfiles(loginUserId: string) {
  const [owned, grants, me] = await Promise.all([
    prisma.family.findUnique({
      where: { ownerId: loginUserId },
      select: { members: { select: { userId: true, isChild: true } } },
    }),
    prisma.familyAccessGrant.findMany({
      where: { granteeId: loginUserId },
      select: { subjectId: true },
    }),
    prisma.user.findUnique({ where: { id: loginUserId }, select: { id: true, displayName: true } }),
  ]);
  const ids = new Set<string>();
  owned?.members.forEach((member) => ids.add(member.userId));
  grants.forEach((grant) => ids.add(grant.subjectId));
  ids.delete(loginUserId);

  const others = await prisma.user.findMany({
    where: { id: { in: [...ids] }, forgottenAt: null },
    select: { id: true, displayName: true, familyMembership: { select: { isChild: true } } },
    orderBy: { createdAt: "asc" },
  });
  // Tildelinger overlever ikke, at et medlem forlader familien (leaveFamily
  // sletter dem), men tjek alligevel, så listen aldrig viser noget ulovligt.
  const allowed = [];
  for (const other of others) {
    if (await canActFor(loginUserId, other.id)) {
      allowed.push({ id: other.id, displayName: other.displayName, isChild: other.familyMembership?.isChild ?? false });
    }
  }
  return [
    { id: loginUserId, displayName: me?.displayName ?? "", isChild: false },
    ...allowed,
  ];
}

export async function logProfileAccess(
  subjectId: string,
  actorId: string,
  action: ProfileAccessAction,
  area: ProfileArea
) {
  if (action === "VIEWED") {
    const recent = await prisma.profileAccessLog.findFirst({
      where: {
        subjectId,
        actorId,
        area,
        action: "VIEWED",
        createdAt: { gte: new Date(Date.now() - VIEW_DEDUPE_MS) },
      },
      select: { id: true },
    });
    if (recent) return;
  }
  await prisma.profileAccessLog.create({ data: { subjectId, actorId, action, area } });
}

// Den valgte profil (eller den indloggede selv) plus den indloggede. Når
// profilen tilhører en anden, logges handlingen, så profilens ejer kan se den
// i Kontrol-loggen.
export async function getProfileContext(
  area: ProfileArea,
  action: ProfileAccessAction
): Promise<{ login: User; profile: User } | null> {
  const login = await getSessionUser();
  if (!login) return null;

  const store = await cookies();
  const activeId = store.get(ACTIVE_PROFILE_COOKIE)?.value;
  if (!activeId || activeId === login.id) return { login, profile: login };
  if (!(await canActFor(login.id, activeId))) return { login, profile: login };

  const profile = await prisma.user.findUnique({ where: { id: activeId } });
  if (!profile || profile.forgottenAt) return { login, profile: login };

  await logProfileAccess(profile.id, login.id, action, area);
  return { login, profile };
}

export async function getProfileUser(area: ProfileArea, action: ProfileAccessAction): Promise<User | null> {
  return (await getProfileContext(area, action))?.profile ?? null;
}

// Må den indloggede slette en registrering på den viste profil? Profilens
// ejer må ikke slette det, andre har tastet ind, hvis den, der oprettede
// profilen, har slået det fra (FamilyMember.canDeleteOthersEntries).
export async function mayDeleteRegistration(loginId: string, profileId: string, createdById: string | null) {
  if (!createdById || createdById === loginId || loginId !== profileId) return true;
  const member = await prisma.familyMember.findUnique({
    where: { userId: profileId },
    select: { canDeleteOthersEntries: true },
  });
  return member?.canDeleteOthersEntries ?? true;
}

type ShareTarget = { profileId: string; factor: number };

// Fælles måltid (docs/FAMILY.md): samme registrering kopieres til de valgte
// profiler med hver deres portion (factor × den registrerede mængde). Hver
// kopi er et selvstændigt snapshot.
export async function shareRegistration(
  registration: Record<string, unknown> & { id: string; userId: string },
  shareWith: unknown,
  loginId: string
): Promise<number> {
  if (!Array.isArray(shareWith)) return 0;
  const targets: ShareTarget[] = shareWith
    .filter(
      (item): item is ShareTarget =>
        Boolean(item) &&
        typeof item.profileId === "string" &&
        typeof item.factor === "number" &&
        Number.isFinite(item.factor) &&
        item.factor >= 0.1 &&
        item.factor <= 3
    )
    .filter((item, index, all) => item.profileId !== registration.userId && all.findIndex((o) => o.profileId === item.profileId) === index)
    .slice(0, 10);
  if (targets.length === 0) return 0;

  const source = await prisma.registration.findUnique({ where: { id: registration.id } });
  if (!source) return 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, userId, createdById, ...snapshot } = source;
  const scaleKeys = Object.keys(snapshot).filter(
    (key) => key === "amountGrams" || key.endsWith("Snapshot")
  ) as (keyof typeof snapshot)[];

  let count = 0;
  for (const target of targets) {
    if (!(await canActFor(loginId, target.profileId))) continue;
    const data: Record<string, unknown> = { ...snapshot };
    for (const key of scaleKeys) {
      const value = snapshot[key];
      if (typeof value === "number") data[key] = value * target.factor;
    }
    await prisma.registration.create({
      data: {
        ...(data as typeof snapshot),
        userId: target.profileId,
        createdById: target.profileId === loginId ? null : loginId,
      },
    });
    if (target.profileId !== loginId) await logProfileAccess(target.profileId, loginId, "CREATED", "registrations");
    count += 1;
  }
  return count;
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import {
  ACTIVE_PROFILE_COOKIE,
  PRESENCE_WINDOW_MS,
  canActFor,
  listAccessibleProfiles,
} from "@/lib/family-access";
import { MAX_FAMILY_PROFILES, createFamily, getFamilyOverview, hasActiveFamilyPlan } from "@/lib/family";
import { familyErrorResponse } from "@/lib/family-api";

// Familiestatus til profilvælgeren, topbjælken (telefonikon + blå ramme) og
// panelet med nye hændelser (docs/FAMILY.md). Hentes ved hvert sideskift og
// hvert halve minut, så den holdes let.
export async function GET() {
  const login = await getSessionUser();
  if (!login) return unauthorized();

  const store = await cookies();
  const cookieId = store.get(ACTIVE_PROFILE_COOKIE)?.value;
  const activeId = cookieId && (await canActFor(login.id, cookieId)) ? cookieId : login.id;

  const [profiles, family, hasFamilyPlan] = await Promise.all([
    listAccessibleProfiles(login.id),
    getFamilyOverview(login.id),
    hasActiveFamilyPlan(login.id),
  ]);
  const activeProfile = profiles.find((profile) => profile.id === activeId) ?? profiles[0];

  // Andre end den indloggede, der har været på den viste profil inden for
  // de sidste 5 minutter (blå ramme + telefonikon). Når man selv ser en
  // andens profil, er man selv "den anden" og vises også.
  const recent = await prisma.profileAccessLog.findMany({
    where: {
      subjectId: activeProfile.id,
      createdAt: { gte: new Date(Date.now() - PRESENCE_WINDOW_MS) },
      actorId: { not: activeProfile.id },
      area: { not: "login" },
    },
    orderBy: { createdAt: "desc" },
    select: { actor: { select: { id: true, displayName: true } } },
    take: 20,
  });
  const presence = new Map<string, { id: string; displayName: string }>();
  if (activeProfile.id !== login.id) presence.set(login.id, { id: login.id, displayName: login.displayName });
  for (const row of recent) presence.set(row.actor.id, row.actor);

  // Nye hændelser på den indloggedes egen profil fra andre personer.
  const unseenCount = await prisma.profileAccessLog.count({
    where: {
      subjectId: login.id,
      actorId: { not: login.id },
      ...(login.accessLogSeenAt ? { createdAt: { gt: login.accessLogSeenAt } } : {}),
    },
  });

  return NextResponse.json({
    me: { id: login.id, displayName: login.displayName },
    activeProfile,
    profiles,
    family,
    hasFamilyPlan,
    maxProfiles: MAX_FAMILY_PROFILES,
    presence: [...presence.values()],
    unseenCount,
  });
}

// Opret familien (kræver aktivt familieabonnement).
export async function POST() {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  try {
    await createFamily(login.id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return familyErrorResponse(error);
  }
}

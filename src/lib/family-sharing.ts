// "Del med andre" på Familie-siden (docs/FAMILY.md): hvem i familien kan se
// og taste ind på en profil, og hvad de kan se. Regnes ud fra familie-
// oversigten i GET /api/family, så siden ikke skal hente mere.
// Samme regel som canActFor i src/lib/family-access.ts: betaleren har altid
// adgang, andre kun via en tildeling fra betaleren.

export type SharingPerson = { userId: string; displayName: string; isOwner: boolean };

type FamilyForSharing = {
  ownerId: string;
  ownerName: string;
  members: { userId: string; displayName: string }[];
  grants: { granteeId: string; subjectId: string }[];
};

export function peopleSharedWith(family: FamilyForSharing, subjectId: string): SharingPerson[] {
  const people: SharingPerson[] = [];
  if (family.ownerId !== subjectId) {
    people.push({ userId: family.ownerId, displayName: family.ownerName, isOwner: true });
  }
  for (const member of family.members) {
    if (member.userId === subjectId || member.userId === family.ownerId) continue;
    if (family.grants.some((grant) => grant.granteeId === member.userId && grant.subjectId === subjectId)) {
      people.push({ userId: member.userId, displayName: member.displayName, isOwner: false });
    }
  }
  return people;
}

// Det, en person med adgang kan se og taste ind — dagbogsområderne, der følger
// den aktive profil (ProfileArea i src/lib/family-access.ts, uden "login";
// favoritter og opskriftsfavoritter er slået sammen). Nøglerne er
// i18n-nøgler under family.sharing.area.
export const SHARED_PROFILE_AREAS = [
  "profile",
  "registrations",
  "water",
  "weight",
  "activities",
  "bodyMeasurements",
  "goals",
  "sleep",
  "healthMetrics",
  "menstrualCycle",
  "workShifts",
  "favorites",
] as const;

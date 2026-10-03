// "Del med andre" på Familie-siden (docs/FAMILY.md): hvem i familien kan se
// og taste ind på en profil, hvad de kan se, og hvem der bestemmer det.
// Ren logik uden database, så både server og klient bruger den.
// Samme regel som canActFor i src/lib/family-access.ts: betaleren har altid
// adgang, andre kun via en tildeling (FamilyAccessGrant).

// Fra denne alder må et barn selv bestemme over sin profil (samme grænse som
// udmelding af familien, docs/FAMILY.md punkt 3 + 4).
export const FAMILY_SELF_CONSENT_AGE = 15;

type SharingSubject = { userId: string; hasLogin: boolean; isChild: boolean; age: number | null };

// Hvem bestemmer, hvem andre i familien må se profilen? Personen selv, når
// vedkommende har eget login og ikke er et barn under 15 — det kommer ikke
// betaleren ved (ejerens beslutning 2026-10-03). Profiler uden eget login og
// børn under 15 styres af betaleren.
export function sharingDeciderId(subject: SharingSubject, ownerId: string): string {
  if (subject.userId === ownerId) return ownerId;
  const tooYoung = subject.isChild && (subject.age === null || subject.age < FAMILY_SELF_CONSENT_AGE);
  return subject.hasLogin && !tooYoung ? subject.userId : ownerId;
}

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

// Alder beregnet ud fra en fuld fødselsdato (User.birthDate), så den opdateres
// automatisk år for år i stedet for at være en fastfrosset værdi indtastet én
// gang — se docs/DECISIONS.md 2026-09-19.
export function computeAge(birthDate: Date | string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;

  return age >= 0 ? age : null;
}

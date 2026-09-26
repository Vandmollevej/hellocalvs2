export function ageFromBirthDate(birthDate: Date, now = new Date()) {
  let age = now.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    now.getMonth() < birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

// Brugerens e-mail (login-navn) må aldrig vises i admin eller returneres i
// admin-API'er. Admin ser kun visningsnavn; findes det ikke, en kort anonym
// etiket afledt af bruger-ID'et (nok til at skelne sager, ikke til at gætte e-mailen).
export function userLabel(user: { id?: string | null; displayName?: string | null } | null | undefined): string {
  const name = user?.displayName?.trim();
  if (name) return name;
  return user?.id ? `Bruger ${user.id.slice(-6)}` : "Bruger";
}

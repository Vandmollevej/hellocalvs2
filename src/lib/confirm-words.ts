// Kontrolord ved "Luk konto" og "Ret til at blive glemt" (Profil). Ordet i appen
// følger sproget (accountSettings.confirmWord / closeWord), så serveren
// accepterer ordet fra ethvert sprog (case-insensitive).
export const FORGET_WORDS = ["SLET", "DELETE", "LÖSCHEN", "SUPPRIMER", "VERWIJDEREN", "SLETT", "RADERA"] as const;
export const CLOSE_WORDS = ["LUK", "CLOSE", "SCHLIESSEN", "FERMER", "SLUITEN", "LUKK", "STÄNG"] as const;

export function isConfirmWord(mode: "close" | "forget", value: unknown): boolean {
  if (typeof value !== "string") return false;
  const typed = value.trim().toLocaleUpperCase("da-DK");
  return (mode === "close" ? CLOSE_WORDS : FORGET_WORDS).some((word) => word === typed);
}

// Standardteksten, der deles fra "Invitér en ven" (SMS, e-mail, beskeder …)
// og vises som forhåndsvisning på siden. Linket sendes separat, så
// delemenuen selv kan placere det.
export const INVITE_NOTE_MAX_LENGTH = 160;
export const INVITE_NAME_MAX_LENGTH = 60;

export function buildInviteMessage({ name, note }: { name: string; note: string }) {
  const trimmedName = name.trim();
  const trimmedNote = note.trim();
  const greeting = trimmedName ? `Hej! Det er ${trimmedName}.` : "Hej!";
  const parts = [
    `${greeting} Jeg vil gerne invitere dig til Hello Cal – appen, der gør det nemt at holde styr på kalorier, vægt og gode vaner.`,
  ];
  if (trimmedNote) parts.push(trimmedNote);
  parts.push("Opret din gratis konto via linket, så optjener vi begge 300 points.");
  return parts.join("\n\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Skabelonvariabler til FRIEND_INVITATION-mailen. Brugerens navn og note er
// fri tekst og escapes, før de sættes ind i HTML.
export function inviteEmailVars({
  name,
  note,
  fallbackName,
  inviteUrl,
}: {
  name?: unknown;
  note?: unknown;
  fallbackName: string;
  inviteUrl: string;
}) {
  const cleanName = typeof name === "string" ? name.trim().slice(0, INVITE_NAME_MAX_LENGTH) : "";
  const cleanNote = typeof note === "string" ? note.trim().slice(0, INVITE_NOTE_MAX_LENGTH) : "";
  return {
    inviterName: escapeHtml(cleanName || fallbackName),
    personalMessage: cleanNote ? `<p>“${escapeHtml(cleanNote)}”</p>` : "",
    inviteUrl,
  };
}

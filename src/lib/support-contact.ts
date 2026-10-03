// Telefon til Support (docs/DECISIONS.md 2026-10-02). Sættes i
// /deploy/.env.production — vises kun i appen, når nummeret er sat.
// SUPPORT_PHONE: fx "+45 12 34 56 78". SUPPORT_PHONE_HOURS: fx
// "Hverdage 9–15". Læses på serveren og sendes til appen via /api/chatbot,
// så et nyt nummer ikke kræver et nyt build.
export type SupportContactInfo = {
  phone: string | null;
  phoneHref: string | null;
  phoneHours: string | null;
};

export function getSupportContactInfo(): SupportContactInfo {
  const phone = process.env.SUPPORT_PHONE?.trim() || null;
  const phoneHours = process.env.SUPPORT_PHONE_HOURS?.trim() || null;
  const digits = phone ? phone.replace(/[^\d+]/g, "") : "";
  return { phone, phoneHref: digits ? `tel:${digits}` : null, phoneHours };
}

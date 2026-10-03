// Afsenderadresser pr. formål (docs/DECISIONS.md 2026-09-29). Alle ligger på
// det verificerede Mailjet-domæne hellocal.io, så de kræver ingen ekstra
// godkendelse. SMTP_FROM bruges kun, hvis den er sat til noget andet end den
// gamle no-reply@-adresse.
const NAME = "Hello Cal";
export const SIGNUP_FROM = `${NAME} <signup@hellocal.io>`;
export const INVITE_FROM = `${NAME} <invite@hellocal.io>`;
export const NOREPLY_FROM = `${NAME} <noreply@hellocal.io>`;

export function defaultFrom() {
  const env = process.env.SMTP_FROM;
  return env && !/no-reply@hellocal\.io/i.test(env) ? env : NOREPLY_FROM;
}

const SIGNUP_EVENTS = new Set(["ACCOUNT_CREATED", "EMAIL_VERIFICATION"]);
const INVITE_EVENTS = new Set(["FRIEND_REFERRAL", "FRIEND_INVITATION", "FRIEND_FORWARD_RECEIVED", "DOCTOR_SHARE_INVITATION", "FAMILY_INVITATION"]);

export function fromForEvent(event: string) {
  if (SIGNUP_EVENTS.has(event)) return SIGNUP_FROM;
  if (INVITE_EVENTS.has(event)) return INVITE_FROM;
  return defaultFrom();
}

// Mailjet omskriver ellers alle links til mjt.lu og lægger et sporingsbillede
// i mailen — begge dele giver spam-flag hos bl.a. Simply. Transaktionsmails
// skal have de rigtige links og intet sporingspixel.
export const NO_TRACKING_HEADERS = { "X-Mailjet-TrackOpen": "0", "X-Mailjet-TrackClick": "0" };

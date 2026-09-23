// docs/PRIVACY.md: de eneste profilfelter serveren kender. Alt andet i
// profilen ligger krypteret i brugerens boks (src/lib/vault/handlers/profile.ts).
// region bruges til søgerangering, appLocale til sprog, wants* til hvilke
// beskeder serveren må sende. Ingen af dem siger noget om brugeren selv.
export const SERVER_PROFILE_FIELDS = [
  "region",
  "appLocale",
  "wantsPushNotifications",
  "wantsUpdateNewsEmails",
  "wantsAdviceEmails",
  "wantsPartnerOffersEmails",
] as const;

export type ServerProfileField = (typeof SERVER_PROFILE_FIELDS)[number];

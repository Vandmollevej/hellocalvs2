// Felter serveren udleverer om en Hello Doc-deling (docs/PRIVACY.md).
// Modtagerens navn/e-mail og nøglen findes kun i ejerens boks.
export const SHARE_SELECT = {
  id: true,
  token: true,
  status: true,
  categories: true,
  historyRange: true,
  sentAt: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  snapshotUpdatedAt: true,
} as const;

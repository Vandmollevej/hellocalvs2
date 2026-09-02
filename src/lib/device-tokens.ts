import { randomBytes, createHash } from "crypto";

// Personal device tokens for a future native companion app (see
// docs/HEALTHKIT_COMPANION.md). Only the SHA-256 hash is stored — same principle
// as a personal API key flow (e.g. GitHub PAT); the raw value is shown only once
// at creation and can never be recovered.
const TOKEN_PREFIX = "hcal_";

export function generateDeviceToken() {
  const raw = `${TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  return { raw, hash: hashDeviceToken(raw) };
}

export function hashDeviceToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

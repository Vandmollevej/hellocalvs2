import { randomBytes, createHash } from "crypto";

// Personlige enhedstokens til en fremtidig native companion-app (se
// docs/HEALTHKIT_COMPANION.md). Kun SHA-256-hashen gemmes — samme princip som
// et personligt API-nøgle-flow (fx GitHub PAT); den rå værdi vises kun én
// gang ved oprettelse og kan aldrig genskabes.
const TOKEN_PREFIX = "hcal_";

export function generateDeviceToken() {
  const raw = `${TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  return { raw, hash: hashDeviceToken(raw) };
}

export function hashDeviceToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

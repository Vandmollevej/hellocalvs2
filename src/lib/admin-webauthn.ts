// Derives the WebAuthn relying-party ID and expected origin from the actual
// request instead of a fixed env var, so the same code works against the
// production hostname (adminhellocal.packroff.dk) and localhost in dev.
export function getWebauthnRelyingParty(req: Request) {
  const originHeader = req.headers.get("origin");
  const hostHeader = req.headers.get("host") ?? "localhost";
  const origin = originHeader ?? `http://${hostHeader}`;
  const rpID = new URL(origin).hostname;
  return { rpID, origin };
}

export const WEBAUTHN_RP_NAME = "HELLO CAL Admin";

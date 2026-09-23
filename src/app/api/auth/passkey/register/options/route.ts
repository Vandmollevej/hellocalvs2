import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { findEmailLinkToken, hashToken } from "@/lib/email-link";
import { getUserRelyingParty, setPendingCeremony, WEBAUTHN_USER_RP_NAME, type PendingRegistration } from "@/lib/user-webauthn";

// POST /api/auth/passkey/register/options
//   { mode: "signup", emailToken, referralCode? } — ny konto efter e-mailbekræftelse
//   { mode: "recovery", claim }                    — ny passkey efter godkendt gendannelse
//   { mode: "add" }                                 — ekstra passkey for logget-ind bruger
//
// Passkeyens brugernavn er et tilfældigt, intetsigende ID — aldrig e-mail
// eller navn (docs/PRIVACY.md).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mode = body?.mode;

  let pending: Omit<PendingRegistration, "challenge" | "kind">;
  let excludeCredentialIds: string[] = [];

  if (mode === "signup") {
    const token = await findEmailLinkToken("SIGNUP", typeof body?.emailToken === "string" ? body.emailToken : "");
    if (!token) return NextResponse.json({ message: "Linket er udløbet. Start forfra." }, { status: 400 });
    const taken = await prisma.user.findUnique({ where: { emailHash: token.emailHash }, select: { id: true } });
    if (taken) return NextResponse.json({ message: "Der findes allerede en konto. Brug gendannelse." }, { status: 409 });
    pending = {
      mode,
      userId: `u_${randomBytes(12).toString("base64url")}`,
      refId: token.id,
      referralCode: typeof body?.referralCode === "string" ? body.referralCode.slice(0, 64) : undefined,
    };
  } else if (mode === "recovery") {
    const claim = typeof body?.claim === "string" ? body.claim : "";
    const request = claim
      ? await prisma.recoveryRequest.findUnique({ where: { releaseTokenHash: hashToken(claim) } })
      : null;
    if (!request || request.status !== "APPROVED" || request.expiresAt < new Date()) {
      return NextResponse.json({ message: "Gendannelsen er ikke godkendt eller er udløbet" }, { status: 403 });
    }
    pending = { mode, userId: request.userId, refId: request.id };
  } else if (mode === "add") {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
    const existing = await prisma.passkey.findMany({ where: { userId: user.id }, select: { credentialId: true } });
    excludeCredentialIds = existing.map((p) => p.credentialId);
    pending = { mode, userId: user.id };
  } else {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const { rpID } = getUserRelyingParty(req);
  const anonymousName = `hellocal-${randomBytes(4).toString("hex")}`;
  const options = await generateRegistrationOptions({
    rpName: WEBAUTHN_USER_RP_NAME,
    rpID,
    userName: anonymousName,
    userDisplayName: "Hello Cal",
    userID: new TextEncoder().encode(pending.userId),
    attestationType: "none",
    excludeCredentials: excludeCredentialIds.map((id) => ({ id })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });

  const response = NextResponse.json(options);
  await setPendingCeremony(response, { kind: "reg", challenge: options.challenge, ...pending });
  return response;
}

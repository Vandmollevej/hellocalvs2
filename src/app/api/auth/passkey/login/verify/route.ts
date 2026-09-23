import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { setUserSessionCookie } from "@/lib/user-session-cookie";
import { clearPendingCeremony, getUserRelyingParty, readPendingCeremony } from "@/lib/user-webauthn";

const FAILURE = { message: "Kunne ikke logge ind med passkey" };

// POST /api/auth/passkey/login/verify — { response }
// Returnerer brugerens krypterede nøglekuvert for netop denne passkey, så
// klienten kan åbne hovednøglen med PRF-outputtet (docs/PRIVACY.md).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { response?: AuthenticationResponseJSON } | null;
  const credentialId = body?.response?.id;
  if (!body?.response || !credentialId) return NextResponse.json(FAILURE, { status: 401 });

  const rateKey = `user-passkey:${credentialId}`;
  if (isLocked(rateKey)) return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });

  const pending = await readPendingCeremony("auth");
  if (!pending) return NextResponse.json({ message: "Login-forsøget er udløbet, prøv igen" }, { status: 400 });

  const passkey = await prisma.passkey.findUnique({ where: { credentialId }, include: { user: true } });
  if (!passkey || passkey.user.role !== "USER" || passkey.user.forgottenAt) {
    recordFailure(rateKey);
    return NextResponse.json(FAILURE, { status: 401 });
  }

  const { rpID, origin } = getUserRelyingParty(req);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    });
  } catch {
    recordFailure(rateKey);
    return NextResponse.json(FAILURE, { status: 401 });
  }
  if (!verification.verified) {
    recordFailure(rateKey);
    return NextResponse.json(FAILURE, { status: 401 });
  }
  recordSuccess(rateKey);

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });
  const envelope = await prisma.keyEnvelope.findUnique({
    where: { credentialId },
    select: { iv: true, ciphertext: true },
  });

  const response = NextResponse.json({ ok: true, credentialId, envelope });
  clearPendingCeremony(response);
  await setUserSessionCookie(response, passkey.userId);
  return response;
}

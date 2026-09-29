import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import {
  SCAN_COOKIE_OPTIONS,
  SCAN_SESSION_COOKIE,
  SCAN_SESSION_MAX_AGE,
  SCAN_WEBAUTHN_AUTH_COOKIE,
  signScanSession,
  verifyScanWebauthnChallenge,
} from "@/lib/scan/auth";
import { getWebauthnRelyingParty } from "@/lib/admin-webauthn";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

const GENERIC_FAILURE = { message: "Kunne ikke logge ind med Face ID" };

// En verificeret passkey med brugerbekræftelse (Face ID/kode) beviser både
// enhed og person — svarer til adgangskode + TOTP, så den giver fuld session.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { response?: AuthenticationResponseJSON };
  const credentialId = body.response?.id;
  if (!credentialId) return NextResponse.json(GENERIC_FAILURE, { status: 401 });

  const key = `scan-passkey:${credentialId}`;
  if (isLocked(key)) return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });

  const store = await cookies();
  const token = store.get(SCAN_WEBAUTHN_AUTH_COOKIE)?.value;
  const pending = token ? await verifyScanWebauthnChallenge(token, "auth") : null;
  if (!pending) return NextResponse.json({ message: "Login-forsøget er udløbet, prøv igen" }, { status: 400 });

  const passkey = await prisma.scanWorkerPasskey.findUnique({ where: { credentialId }, include: { worker: true } });
  if (!passkey || passkey.worker.status !== "ACTIVE") {
    recordFailure(key);
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }

  const { rpID, origin } = getWebauthnRelyingParty(req);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response!,
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
    verification = null;
  }
  if (!verification?.verified) {
    recordFailure(key);
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }
  recordSuccess(key);

  const now = new Date();
  await prisma.$transaction([
    prisma.scanWorkerPasskey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: now },
    }),
    prisma.scanWorker.update({ where: { id: passkey.workerId }, data: { lastLoginAt: now } }),
  ]);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SCAN_SESSION_COOKIE, await signScanSession(passkey.workerId), { ...SCAN_COOKIE_OPTIONS, maxAge: SCAN_SESSION_MAX_AGE });
  response.cookies.delete(SCAN_WEBAUTHN_AUTH_COOKIE);
  return response;
}

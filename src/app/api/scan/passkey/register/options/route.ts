import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { requireScanWorker } from "@/lib/scan/require-worker";
import { SCAN_COOKIE_OPTIONS, SCAN_WEBAUTHN_MAX_AGE, SCAN_WEBAUTHN_REG_COOKIE, signScanWebauthnChallenge } from "@/lib/scan/auth";
import { getWebauthnRelyingParty } from "@/lib/admin-webauthn";

// Trin 1 af "Slå Face ID til" for en indlogget medarbejder.
export async function POST(req: Request) {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const existing = await prisma.scanWorkerPasskey.findMany({ where: { workerId: worker.id } });
  const { rpID } = getWebauthnRelyingParty(req);
  const options = await generateRegistrationOptions({
    rpName: "Hello Cal Oprettelses-app",
    rpID,
    userName: worker.username ?? worker.email,
    userDisplayName: worker.name,
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports as AuthenticatorTransportFuture[] })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });

  const response = NextResponse.json(options);
  response.cookies.set(SCAN_WEBAUTHN_REG_COOKIE, await signScanWebauthnChallenge(options.challenge, worker.id), {
    ...SCAN_COOKIE_OPTIONS,
    maxAge: SCAN_WEBAUTHN_MAX_AGE,
  });
  return response;
}

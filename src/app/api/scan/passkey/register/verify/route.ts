import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { requireScanWorker } from "@/lib/scan/require-worker";
import { SCAN_WEBAUTHN_REG_COOKIE, verifyScanWebauthnChallenge } from "@/lib/scan/auth";
import { getWebauthnRelyingParty } from "@/lib/admin-webauthn";

export async function POST(req: Request) {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { response?: RegistrationResponseJSON; name?: string };
  if (!body.response) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });

  const store = await cookies();
  const token = store.get(SCAN_WEBAUTHN_REG_COOKIE)?.value;
  const pending = token ? await verifyScanWebauthnChallenge(token, "reg") : null;
  if (!pending || pending.workerId !== worker.id) {
    return NextResponse.json({ message: "Registreringen er udløbet, prøv igen" }, { status: 400 });
  }

  const { rpID, origin } = getWebauthnRelyingParty(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return NextResponse.json({ message: "Kunne ikke verificere Face ID" }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ message: "Kunne ikke verificere Face ID" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await prisma.scanWorkerPasskey.create({
    data: {
      workerId: worker.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: body.name?.trim().slice(0, 60) || "Face ID",
    },
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SCAN_WEBAUTHN_REG_COOKIE);
  return response;
}

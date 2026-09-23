import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeEmailLinkToken, findEmailLinkToken } from "@/lib/email-link";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { CASE_TTL_MS, findRequestByClaim, generateCaseCode, generateClaim, sameHash } from "@/lib/recovery";
import { isBase64Url } from "@/lib/vault/server";

// POST /api/auth/recovery — gendannelse (docs/PRIVACY.md "Gendannelse").
//   { action: "start",  emailToken, fileHash } → { caseCode, claim }
//   { action: "reset",  emailToken }           → { claim } (start forfra uden data)
//   { action: "status", claim }                → { status, caseCode }
//   { action: "claim",  claim }                → { serverShare, envelope } når godkendt
//
// claim er et hemmeligt token, som kun den gendannende enhed kender. Det
// udleveres én gang og gemmes kun som hash.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;

  if (action === "start" || action === "reset") {
    const token = await findEmailLinkToken("RECOVERY", typeof body?.emailToken === "string" ? body.emailToken : "");
    if (!token) return NextResponse.json({ message: "Linket er udløbet. Start forfra." }, { status: 400 });
    const user = await prisma.user.findUnique({
      where: { emailHash: token.emailHash },
      include: { recoveryShare: true },
    });
    if (!user || user.forgottenAt) return NextResponse.json({ message: "Kontoen findes ikke" }, { status: 404 });

    if (action === "start") {
      const rateKey = `recovery-file:${user.id}`;
      if (isLocked(rateKey)) return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });
      if (!isBase64Url(body?.fileHash, 64) || !user.recoveryShare || !sameHash(body!.fileHash as string, user.recoveryShare.fileHash)) {
        recordFailure(rateKey);
        return NextResponse.json({ message: "Gendannelsesfilen passer ikke til kontoen" }, { status: 400 });
      }
      recordSuccess(rateKey);
      if (!(await consumeEmailLinkToken(token.id))) {
        return NextResponse.json({ message: "Linket er allerede brugt" }, { status: 400 });
      }
      // Kun én åben sag ad gangen.
      await prisma.recoveryRequest.updateMany({
        where: { userId: user.id, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "EXPIRED" },
      });
      const { claim, claimHash } = generateClaim();
      const request = await prisma.recoveryRequest.create({
        data: {
          userId: user.id,
          caseCode: generateCaseCode(),
          releaseTokenHash: claimHash,
          expiresAt: new Date(Date.now() + CASE_TTL_MS),
        },
      });
      return NextResponse.json({ caseCode: request.caseCode, claim });
    }

    // reset: brugeren har hverken enhed eller fil. Nøglerne slettes, så de
    // gamle data er tabt for altid; kontoen fortsætter tom med ny passkey.
    if (!(await consumeEmailLinkToken(token.id))) {
      return NextResponse.json({ message: "Linket er allerede brugt" }, { status: 400 });
    }
    const { claim, claimHash } = generateClaim();
    await prisma.$transaction([
      prisma.keyEnvelope.deleteMany({ where: { userId: user.id } }),
      prisma.recoveryShare.deleteMany({ where: { userId: user.id } }),
      prisma.passkey.deleteMany({ where: { userId: user.id } }),
      prisma.recoveryRequest.updateMany({
        where: { userId: user.id, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "EXPIRED" },
      }),
      prisma.recoveryRequest.create({
        data: {
          userId: user.id,
          caseCode: generateCaseCode(),
          status: "APPROVED",
          approvedAt: new Date(),
          releaseTokenHash: claimHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      }),
    ]);
    return NextResponse.json({ claim });
  }

  if (action === "status" || action === "claim") {
    const request = await findRequestByClaim(body?.claim);
    if (!request) return NextResponse.json({ message: "Ukendt sag" }, { status: 404 });
    if (action === "status") return NextResponse.json({ status: request.status, caseCode: request.caseCode });

    if (request.status !== "APPROVED") {
      return NextResponse.json({ message: "Sagen er ikke godkendt", status: request.status }, { status: 403 });
    }
    const [share, envelope] = await Promise.all([
      prisma.recoveryShare.findUnique({ where: { userId: request.userId }, select: { serverShare: true } }),
      prisma.keyEnvelope.findFirst({
        where: { userId: request.userId, kind: "RECOVERY" },
        select: { iv: true, ciphertext: true },
      }),
    ]);
    return NextResponse.json({ serverShare: share?.serverShare ?? null, envelope: envelope ?? null });
  }

  return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
}

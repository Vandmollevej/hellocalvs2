import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isPushConfigured, sendPushToUser } from "@/lib/push";
import { isKnownDevice, requestLoginInfo } from "@/lib/user-login";

// Login-godkendelse via push (docs/DECISIONS.md 2026-10-03). Slår brugeren
// den til, skal et login med adgangskode fra en NY enhed godkendes på en anden
// enhed, hvor brugeren allerede er logget ind. Uden push-abonnement (eller
// uden VAPID-nøgler) springes kravet over, så ingen låses ude.
const APPROVAL_TTL_MS = 5 * 60 * 1000;

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export type ApprovalStart = { approvalId: string; secret: string };

// Returnerer null, hvis login kan gennemføres direkte.
export async function startLoginApprovalIfRequired(
  req: Request,
  user: { id: string; displayName: string; loginApprovalEnabled: boolean }
): Promise<ApprovalStart | null> {
  if (!user.loginApprovalEnabled || !isPushConfigured()) return null;
  if (await isKnownDevice(req, user.id)) return null;
  const subscriptions = await prisma.pushSubscription.count({ where: { userId: user.id } });
  if (subscriptions === 0) return null;

  const { device, country } = requestLoginInfo(req);
  const secret = randomBytes(32).toString("base64url");
  const approval = await prisma.loginApproval.create({
    data: {
      userId: user.id,
      secretHash: hashSecret(secret),
      device,
      country,
      expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
    },
    select: { id: true },
  });

  const { sent } = await sendPushToUser(
    user.id,
    "Godkend login",
    `Er det dig, der logger ind fra ${device}? Tryk for at godkende eller afvise.`,
    "/approve-login"
  );
  // Ingen enhed kunne nås (alle abonnementer var udløbet): lad login gå igennem
  // frem for at låse brugeren ude.
  if (sent === 0) {
    await prisma.loginApproval.delete({ where: { id: approval.id } }).catch(() => undefined);
    return null;
  }
  return { approvalId: approval.id, secret };
}

export type ApprovalPoll = "pending" | "approved" | "denied" | "expired";

// Kaldes af den ventende browser. "approved" forbruger godkendelsen (kun én
// gang) og returnerer bruger-ID'et, så sessionen kan sættes.
export async function pollLoginApproval(
  id: string,
  secret: string
): Promise<{ status: ApprovalPoll; userId?: string }> {
  const record = await prisma.loginApproval.findUnique({ where: { id } });
  if (!record || record.secretHash !== hashSecret(secret)) return { status: "expired" };
  if (record.status === "DENIED") return { status: "denied" };
  if (record.status === "CONSUMED" || record.expiresAt < new Date()) return { status: "expired" };
  if (record.status !== "APPROVED") return { status: "pending" };

  const consumed = await prisma.loginApproval.updateMany({
    where: { id, status: "APPROVED" },
    data: { status: "CONSUMED" },
  });
  return consumed.count === 1 ? { status: "approved", userId: record.userId } : { status: "expired" };
}

export async function listPendingApprovals(userId: string) {
  return prisma.loginApproval.findMany({
    where: { userId, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, device: true, country: true, createdAt: true },
  });
}

export async function respondToApproval(userId: string, id: string, approve: boolean) {
  const result = await prisma.loginApproval.updateMany({
    where: { id, userId, status: "PENDING", expiresAt: { gt: new Date() } },
    data: { status: approve ? "APPROVED" : "DENIED" },
  });
  return result.count === 1;
}

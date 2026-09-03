import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Web Push, forberedt men ikke aktiveret (docs/DECISIONS.md 2026-09-02):
// uden VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY er dette en no-op. Generér
// nøglerne med `npx web-push generate-vapid-keys` og udfyld miljøet
// (se docs/DEPLOYMENT.md) for at aktivere — ingen kodeændring nødvendig.

function isConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT_EMAIL || "mailto:admin@hellocal.local",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export function getPublicVapidKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

// Sender alle QUEUED push/BOTH-beskeder. Kaldes fra scheduleren. Er VAPID
// ikke opsat, rører den ikke ved køen.
export async function flushQueuedPush(limit = 25) {
  if (!isConfigured()) return { sent: 0, skipped: "vapid_not_configured" as const };
  configure();

  const pending = await prisma.outboundMessage.findMany({
    where: { status: "QUEUED", channel: { in: ["PUSH", "BOTH"] } },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  let sent = 0;
  for (const message of pending) {
    if (!message.userId) {
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: { status: "SKIPPED", error: "Ingen bruger at pushe til" },
      });
      continue;
    }
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: message.userId } });
    if (subscriptions.length === 0) {
      await prisma.outboundMessage.update({
        where: { id: message.id },
        data: { status: "SKIPPED", error: "Ingen push-abonnement" },
      });
      continue;
    }

    let anySent = false;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: message.subject ?? "Hello Cal", body: message.bodyHtml ?? "" })
        );
        anySent = true;
      } catch {
        // Udløbet/ugyldigt abonnement — ryd det op, men fortsæt til de øvrige.
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }

    await prisma.outboundMessage.update({
      where: { id: message.id },
      data: anySent
        ? { status: "SENT", sentAt: new Date() }
        : { status: "FAILED", error: "Alle abonnementer fejlede" },
    });
    if (anySent) sent += 1;
  }

  return { sent };
}

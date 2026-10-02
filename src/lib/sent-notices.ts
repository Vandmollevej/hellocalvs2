import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

// "Til info sendte vi dig ..." (docs/DECISIONS.md 2026-10-02): hver mail/sms
// til en kendt bruger giver en push med det samme og en popup ved næste
// besøg i appen, så brugeren kan se, at beskeden ikke var spam. Popuppen
// bygger på OutboundMessage-loggen — der gemmes ingen adresse/telefonnummer.

export type SentNoticeKind = "EMAIL" | "SMS";

export type SentNotice = { id: string; kind: SentNoticeKind; subject: string; sentAt: string };

// Ældre beskeder er ikke længere relevante som "det var ikke spam".
const MAX_AGE_DAYS = 30;
const MAX_NOTICES = 10;

export async function listSentNotices(userId: string): Promise<SentNotice[]> {
  const rows = await prisma.outboundMessage.findMany({
    where: {
      userId,
      status: "SENT",
      channel: { in: ["EMAIL", "BOTH", "SMS"] },
      noticeAckAt: null,
      sentAt: { gte: new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000) },
    },
    orderBy: { sentAt: "desc" },
    take: MAX_NOTICES,
    select: { id: true, channel: true, subject: true, sentAt: true },
  });
  return rows
    .filter((row) => row.subject && row.sentAt)
    .map((row) => ({
      id: row.id,
      kind: row.channel === "SMS" ? "SMS" : "EMAIL",
      subject: row.subject!,
      sentAt: row.sentAt!.toISOString(),
    }));
}

export async function ackSentNotices(userId: string, ids: string[]) {
  await prisma.outboundMessage.updateMany({
    where: { userId, id: { in: ids }, noticeAckAt: null },
    data: { noticeAckAt: new Date() },
  });
}

// Samme besked som popuppen, sendt som push lige efter afsendelsen. Fejl må
// aldrig vælte selve mail-/sms-afsendelsen.
export async function pushSentNotice(userId: string, kind: SentNoticeKind, subject: string) {
  try {
    const type = kind === "SMS" ? "sms" : "e-mail";
    await sendPushToUser(userId, "Hello Cal", `Vi har netop sendt dig en ${type} om "${subject}". Dette var ikke spam.`);
  } catch (error) {
    console.error("[sent-notices] push fejlede", error);
  }
}

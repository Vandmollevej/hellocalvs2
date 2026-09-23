import { prisma } from "@/lib/prisma";
import { sealToPublicKey } from "@/lib/vault/crypto";

// Serveren lægger data i en brugers indbakke uden at kunne læse dem igen
// (docs/PRIVACY.md "Nøglehierarki"). Bruges af integrationer (Fitbit,
// Withings, HealthKit), der henter data på serveren: data forsegles straks
// og gemmes aldrig i klartekst. Klienten flytter dem ind i boksen.

export type InboxEnvelope = { kind: string; payload: unknown };

export async function deliverToInbox(inboxId: string, items: InboxEnvelope[]) {
  if (items.length === 0) return 0;
  const inbox = await prisma.vaultInbox.findUnique({ where: { id: inboxId }, select: { publicKey: true } });
  if (!inbox) throw new Error("Ukendt indbakke");
  const sealed = await Promise.all(items.map((item) => sealToPublicKey(inbox.publicKey, item)));
  await prisma.vaultInboxItem.createMany({
    data: sealed.map((box) => ({ inboxId, epk: box.epk, iv: box.iv, ciphertext: box.ciphertext })),
  });
  return sealed.length;
}

import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { copenhagenWeekdayHour } from "@/lib/flow-conditions";

// Vejepåmindelser (docs/DECISIONS.md 2026-10-07): en push 5 minutter før hver
// valgt lige time. Kaldes hvert minut fra scheduleren.

export const REMINDER_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
const LEAD_MINUTES = 5;

export function sanitizeReminderHours(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const hours = value.map(Number).filter((h) => REMINDER_HOURS.includes(h));
  return Array.from(new Set(hours)).sort((a, b) => a - b);
}

function copenhagenDate(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(date);
}

/** Sender de påmindelser, der skal ud nu (præcis 5 min før en valgt time). */
export async function sendDueWeighReminders(now: Date = new Date()) {
  const target = new Date(now.getTime() + LEAD_MINUTES * 60_000);
  const { hour } = copenhagenWeekdayHour(target);
  const minute = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Copenhagen", minute: "2-digit" }).format(target));
  // Tæt på hel time (tåler et tick der er op til 4 min for sent).
  if (minute > 4 || !REMINDER_HOURS.includes(hour)) return 0;

  const slot = `${copenhagenDate(target)}-${String(hour).padStart(2, "0")}`;
  const due = await prisma.weighReminderPref.findMany({
    where: { enabled: true, hours: { has: hour }, OR: [{ lastSlot: null }, { lastSlot: { not: slot } }] },
  });
  let sent = 0;
  for (const pref of due) {
    await prisma.weighReminderPref.update({ where: { id: pref.id }, data: { lastSlot: slot } });
    const result = await sendPushToUser(pref.userId, "Husk at veje dig", `Om 5 minutter er klokken ${hour}:00 — tid til at veje dig.`, "/weight");
    sent += result.sent;
  }
  return sent;
}

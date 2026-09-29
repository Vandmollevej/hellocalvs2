import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { NO_TRACKING_HEADERS } from "@/lib/mail-senders";
import { DEFAULT_REPLY_TO, htmlToText, wrapEmailHtml } from "@/lib/email-format";

// Partnerrapporter (docs/DECISIONS.md 2026-09-29). Sikkerhedsregler:
//  1. Modtagere hentes ALTID fra partnerens egne aktive kontakter — aldrig fra
//     klientinput. API'et modtager kun et partnerId.
//  2. Data hentes kun for lokationer med samme partnerId.
//  3. Før hver afsendelse kontrolleres begge dele igen, så en fejl i
//     forespørgslerne aldrig kan sende én partners tal til en anden.
//  4. Hver mail sendes til én modtager ad gangen og logges (PartnerReportSend).

export const REPORT_FROM = process.env.REPORT_SMTP_FROM || "Hello Cal <report@hellocal.io>";

export type LocationStats = { id: string; name: string; placement: string; impressions: number; clicks: number; ctr: number };
export type PartnerStats = { partnerId: string; partnerName: string; locations: LocationStats[]; impressions: number; clicks: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (value: string) => EMAIL_RE.test(value.trim());

export async function getPartnerStats(partnerId: string, from: Date, to: Date): Promise<PartnerStats | null> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: { locations: { orderBy: { name: "asc" } } },
  });
  if (!partner) return null;
  const grouped = await prisma.adEvent.groupBy({
    by: ["locationId", "type"],
    where: { location: { partnerId }, createdAt: { gte: from, lt: to } },
    _count: { _all: true },
  });
  const count = (locationId: string, type: string) =>
    grouped.find((row) => row.locationId === locationId && row.type === type)?._count._all ?? 0;
  const locations = partner.locations.map((location) => {
    const impressions = count(location.id, "IMPRESSION");
    const clicks = count(location.id, "CLICK");
    return {
      id: location.id,
      name: location.name,
      placement: location.placement,
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
    };
  });
  return {
    partnerId,
    partnerName: partner.name,
    locations,
    impressions: locations.reduce((sum, l) => sum + l.impressions, 0),
    clicks: locations.reduce((sum, l) => sum + l.clicks, 0),
  };
}

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dateDa = (d: Date) =>
  d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Copenhagen" });
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const CELL = "padding:6px 8px;border-bottom:1px solid #e5e5e5";

export function renderReportHtml(stats: PartnerStats, from: Date, to: Date, contactName: string) {
  const lastDay = new Date(to.getTime() - 1);
  const rows = stats.locations
    .map(
      (l) =>
        `<tr><td style="${CELL}">${esc(l.name)}</td><td style="${CELL};text-align:right">${l.impressions}</td><td style="${CELL};text-align:right">${l.clicks}</td><td style="${CELL};text-align:right">${pct(l.ctr)}</td></tr>`
    )
    .join("");
  const head = "padding:6px 8px;border-bottom:2px solid #232323";
  return `<p>Hej ${esc(contactName)},</p><p>Her er rapporten for <strong>${esc(stats.partnerName)}</strong> for perioden ${dateDa(from)} – ${dateDa(lastDay)}.</p><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px"><tr><th style="${head};text-align:left">Lokation</th><th style="${head};text-align:right">Visninger</th><th style="${head};text-align:right">Klik</th><th style="${head};text-align:right">Klikrate</th></tr>${rows || `<tr><td colspan="4" style="padding:8px">Ingen lokationer endnu.</td></tr>`}<tr><td style="padding:6px 8px"><strong>I alt</strong></td><td style="padding:6px 8px;text-align:right"><strong>${stats.impressions}</strong></td><td style="padding:6px 8px;text-align:right"><strong>${stats.clicks}</strong></td><td style="padding:6px 8px;text-align:right"><strong>${pct(stats.impressions > 0 ? stats.clicks / stats.impressions : 0)}</strong></td></tr></table><p>Venlig hilsen<br>Hello Cal</p>`;
}

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export type SendResult = { ok: boolean; sent: number; failed: number; recipients: string[]; message?: string };
const fail = (message: string): SendResult => ({ ok: false, sent: 0, failed: 0, recipients: [], message });

// Aktive kontakter med gyldig, unik e-mail — kun fra den ene partner.
export async function reportRecipients(partnerId: string) {
  const contacts = await prisma.partnerContact.findMany({ where: { partnerId, active: true }, orderBy: { name: "asc" } });
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const email = contact.email.trim().toLowerCase();
    if (contact.partnerId !== partnerId || !isValidEmail(email) || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

// Sender rapporten for ÉN partner til den partners aktive kontakter.
export async function sendPartnerReport(
  partnerId: string,
  { from, to, trigger }: { from: Date; to: Date; trigger: "MANUAL" | "SCHEDULE" }
): Promise<SendResult> {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) return fail("Partneren findes ikke");

  const contacts = await reportRecipients(partnerId);
  if (contacts.length === 0) return fail("Partneren har ingen aktive kontakter med gyldig e-mail");

  const stats = await getPartnerStats(partnerId, from, to);
  if (!stats || stats.partnerId !== partnerId) return fail("Data kunne ikke hentes");

  const foreign = await prisma.adLocation.count({
    where: { id: { in: stats.locations.map((l) => l.id) }, NOT: { partnerId } },
  });
  if (foreign > 0) return fail("Afbrudt: data tilhører en anden partner");

  const transport = getTransport();
  if (!transport) return fail("SMTP er ikke opsat — rapporten blev ikke sendt");

  const subject = `Hello Cal – rapport for ${partner.name} (${dateDa(from)} – ${dateDa(new Date(to.getTime() - 1))})`;
  let sent = 0;
  let failed = 0;
  for (const contact of contacts) {
    const html = renderReportHtml(stats, from, to, contact.name);
    const log = { partnerId, toEmail: contact.email.trim(), contactName: contact.name, trigger, periodStart: from, periodEnd: to };
    try {
      await transport.sendMail({
        from: REPORT_FROM,
        headers: NO_TRACKING_HEADERS,
        replyTo: process.env.SMTP_REPLY_TO || DEFAULT_REPLY_TO,
        to: contact.email.trim(),
        subject,
        html: wrapEmailHtml(html),
        text: htmlToText(html),
      });
      sent += 1;
      await prisma.partnerReportSend.create({ data: { ...log, status: "SENT" } });
    } catch (error) {
      failed += 1;
      await prisma.partnerReportSend.create({
        data: { ...log, status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Ukendt fejl" },
      });
    }
  }
  return { ok: failed === 0, sent, failed, recipients: contacts.map((c) => c.email.trim()) };
}

// --- Perioder og interval ---

export type Frequency = "WEEKLY" | "MONTHLY";

export function periodFor(frequency: Frequency, now: Date) {
  const from = new Date(now);
  if (frequency === "WEEKLY") from.setDate(from.getDate() - 7);
  else from.setMonth(from.getMonth() - 1);
  return { from, to: new Date(now) };
}

export function nextRunAfter(frequency: Frequency, base: Date) {
  const next = new Date(base);
  if (frequency === "WEEKLY") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

// Kaldes fra scheduleren. Hver forfalden plan claimes betinget af nextRunAt,
// så to processer aldrig sender samme rapport to gange.
export async function sendDueReports(now: Date = new Date()) {
  const due = await prisma.partnerReportSchedule.findMany({ where: { enabled: true, nextRunAt: { lte: now } } });
  for (const schedule of due) {
    const claimed = await prisma.partnerReportSchedule.updateMany({
      where: { id: schedule.id, nextRunAt: schedule.nextRunAt },
      data: { nextRunAt: nextRunAfter(schedule.frequency, now) },
    });
    if (claimed.count !== 1) continue;
    const { from, to } = periodFor(schedule.frequency, now);
    const result = await sendPartnerReport(schedule.partnerId, { from, to, trigger: "SCHEDULE" });
    if (result.sent > 0) await prisma.partnerReportSchedule.update({ where: { id: schedule.id }, data: { lastSentAt: now } });
  }
}

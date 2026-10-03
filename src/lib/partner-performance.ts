import { Prisma, type ProductCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NO_TRACKING_HEADERS } from "@/lib/mail-senders";
import { DEFAULT_REPLY_TO, htmlToText, wrapEmailHtml } from "@/lib/email-format";
import { REPORT_FROM, getReportTransport, isValidEmail } from "@/lib/partner-reports";
import { PRODUCT_CATEGORY_LABELS, inventoryItem } from "@/lib/ad-inventory";
import { SimplePdf } from "@/lib/simple-pdf";

// Partnersidens performance (docs/DECISIONS.md 2026-10-02): visninger, klik,
// eksponeringstid og sider pr. reklamespot for én partner i en periode.
// Samme sikkerhedsregel som rapporterne: data hentes kun for lokationer med
// partnerens eget id.

export type PathStats = { path: string; impressions: number; clicks: number; seconds: number };

export type SpotStats = {
  id: string;
  name: string;
  placement: string;
  inventoryKey: string;
  inventoryName: string;
  bannerUrl: string;
  targetUrl: string;
  agreedImpressions: number | null;
  agreedClicks: number | null;
  triggerCategory: ProductCategory | null;
  triggerProductType: string | null;
  agreementId: string | null;
  triggered: boolean;
  impressions: number;
  clicks: number;
  ctr: number;
  seconds: number;
  paths: PathStats[];
};

export type PerformanceTotals = {
  impressions: number;
  clicks: number;
  ctr: number;
  seconds: number;
  avgSeconds: number;
  spots: number;
  agreedImpressions: number;
  fulfilment: number | null;
  uniquePaths: number;
};

export type DayStats = { date: string; impressions: number; clicks: number };

export type PartnerPerformance = {
  partnerId: string;
  partnerName: string;
  from: string;
  to: string;
  onlyTriggered: boolean;
  totals: PerformanceTotals;
  spots: SpotStats[];
  byDay: DayStats[];
};

export const triggerLabel = (spot: { triggerCategory: ProductCategory | null; triggerProductType: string | null }) => {
  const parts: string[] = [];
  if (spot.triggerCategory) parts.push(PRODUCT_CATEGORY_LABELS[spot.triggerCategory] ?? spot.triggerCategory);
  if (spot.triggerProductType) parts.push(spot.triggerProductType);
  return parts.join(" · ");
};

// Periode fra forespørgsel: datoer uden klokkeslæt er inklusive (til-dato =
// hele dagen). Standard: seneste 30 dage.
export function parsePeriod(fromRaw: string | null | undefined, toRaw: string | null | undefined) {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date();
  const to = toRaw && !Number.isNaN(new Date(toRaw).getTime()) ? new Date(toRaw) : now;
  const toExclusive = toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? new Date(to.getTime() + DAY) : to;
  const from = fromRaw && !Number.isNaN(new Date(fromRaw).getTime()) ? new Date(fromRaw) : new Date(toExclusive.getTime() - 30 * DAY);
  return from < toExclusive ? { from, to: toExclusive } : { from: new Date(toExclusive.getTime() - DAY), to: toExclusive };
}

export async function getPartnerPerformance(
  partnerId: string,
  from: Date,
  to: Date,
  { onlyTriggered = false }: { onlyTriggered?: boolean } = {}
): Promise<PartnerPerformance | null> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: { locations: { orderBy: { name: "asc" } } },
  });
  if (!partner) return null;

  const locations = partner.locations.filter(
    (l) => l.partnerId === partnerId && (!onlyTriggered || l.triggerCategory !== null || l.triggerProductType !== null)
  );
  const locationIds = locations.map((l) => l.id);

  const grouped = locationIds.length
    ? await prisma.adEvent.groupBy({
        by: ["locationId", "type", "path"],
        where: { locationId: { in: locationIds }, createdAt: { gte: from, lt: to } },
        _count: { _all: true },
        _sum: { seconds: true },
      })
    : [];

  const spots: SpotStats[] = locations.map((l) => {
    const rows = grouped.filter((g) => g.locationId === l.id);
    const pathMap = new Map<string, PathStats>();
    for (const row of rows) {
      const key = row.path ?? "(ukendt side)";
      const entry = pathMap.get(key) ?? { path: key, impressions: 0, clicks: 0, seconds: 0 };
      if (row.type === "IMPRESSION") {
        entry.impressions += row._count._all;
        entry.seconds += row._sum.seconds ?? 0;
      } else entry.clicks += row._count._all;
      pathMap.set(key, entry);
    }
    const paths = [...pathMap.values()].sort((a, b) => b.impressions - a.impressions);
    const impressions = paths.reduce((s, p) => s + p.impressions, 0);
    const clicks = paths.reduce((s, p) => s + p.clicks, 0);
    const seconds = paths.reduce((s, p) => s + p.seconds, 0);
    return {
      id: l.id,
      name: l.name,
      placement: l.placement,
      inventoryKey: l.inventoryKey,
      inventoryName: inventoryItem(l.inventoryKey)?.name ?? l.placement ?? "",
      bannerUrl: l.bannerUrl,
      targetUrl: l.targetUrl,
      agreedImpressions: l.agreedImpressions,
      agreedClicks: l.agreedClicks,
      triggerCategory: l.triggerCategory,
      triggerProductType: l.triggerProductType,
      agreementId: l.agreementId,
      triggered: l.triggerCategory !== null || l.triggerProductType !== null,
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
      seconds,
      paths,
    };
  });

  const impressions = spots.reduce((s, x) => s + x.impressions, 0);
  const clicks = spots.reduce((s, x) => s + x.clicks, 0);
  const seconds = spots.reduce((s, x) => s + x.seconds, 0);
  const agreedImpressions = spots.reduce((s, x) => s + (x.agreedImpressions ?? 0), 0);
  const uniquePaths = new Set(spots.flatMap((s) => s.paths.map((p) => p.path))).size;

  const byDayRows = locationIds.length
    ? await prisma.$queryRaw<{ day: Date; type: string; count: bigint }[]>(Prisma.sql`
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Europe/Copenhagen') AS day, "type"::text AS type, COUNT(*)::bigint AS count
        FROM "ad_events"
        WHERE "locationId" IN (${Prisma.join(locationIds)}) AND "createdAt" >= ${from} AND "createdAt" < ${to}
        GROUP BY 1, 2 ORDER BY 1`)
    : [];
  const dayMap = new Map<string, DayStats>();
  for (const row of byDayRows) {
    const date = new Date(row.day).toISOString().slice(0, 10);
    const entry = dayMap.get(date) ?? { date, impressions: 0, clicks: 0 };
    if (row.type === "IMPRESSION") entry.impressions += Number(row.count);
    else entry.clicks += Number(row.count);
    dayMap.set(date, entry);
  }

  return {
    partnerId,
    partnerName: partner.name,
    from: from.toISOString(),
    to: to.toISOString(),
    onlyTriggered,
    totals: {
      impressions,
      clicks,
      ctr: impressions > 0 ? clicks / impressions : 0,
      seconds,
      avgSeconds: impressions > 0 ? seconds / impressions : 0,
      spots: spots.length,
      agreedImpressions,
      fulfilment: agreedImpressions > 0 ? impressions / agreedImpressions : null,
      uniquePaths,
    },
    spots,
    byDay: [...dayMap.values()],
  };
}

// --- Sponsoraftaler: budget og forbrug ---

export type AgreementUsage = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  isCurrent: boolean;
  budgetDkk: number;
  cpmDkk: number;
  cpcDkk: number;
  notes: string;
  impressions: number;
  clicks: number;
  spentDkk: number;
  spotCount: number;
};

export async function getAgreementUsage(partnerId: string, now = new Date()): Promise<AgreementUsage[]> {
  const agreements = await prisma.sponsorAgreement.findMany({
    where: { partnerId },
    orderBy: [{ active: "desc" }, { startsAt: "desc" }],
    include: { locations: { select: { id: true } } },
  });
  return Promise.all(
    agreements.map(async (a) => {
      const ids = a.locations.map((l) => l.id);
      const grouped = ids.length
        ? await prisma.adEvent.groupBy({
            by: ["type"],
            where: { locationId: { in: ids }, createdAt: { gte: a.startsAt, ...(a.endsAt ? { lt: a.endsAt } : {}) } },
            _count: { _all: true },
          })
        : [];
      const impressions = grouped.find((g) => g.type === "IMPRESSION")?._count._all ?? 0;
      const clicks = grouped.find((g) => g.type === "CLICK")?._count._all ?? 0;
      const isCurrent = a.active && a.startsAt <= now && (!a.endsAt || a.endsAt > now);
      return {
        id: a.id,
        title: a.title,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt?.toISOString() ?? null,
        active: a.active,
        isCurrent,
        budgetDkk: a.budgetDkk,
        cpmDkk: a.cpmDkk,
        cpcDkk: a.cpcDkk,
        notes: a.notes,
        impressions,
        clicks,
        spentDkk: Math.round(((impressions / 1000) * a.cpmDkk + clicks * a.cpcDkk) * 100) / 100,
        spotCount: ids.length,
      };
    })
  );
}

// --- Formater: CSV og PDF ---

const dateDa = (iso: string) =>
  new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Copenhagen" });
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const num = (v: number) => v.toLocaleString("da-DK");
const periodLabel = (p: PartnerPerformance) => `${dateDa(p.from)} – ${dateDa(new Date(new Date(p.to).getTime() - 1).toISOString())}`;

export function formatSeconds(seconds: number) {
  if (seconds < 60) return `${num(Math.round(seconds))} sek.`;
  if (seconds < 3600) return `${num(Math.round(seconds / 60))} min.`;
  return `${(seconds / 3600).toFixed(1).replace(".", ",")} timer`;
}

const csvCell = (value: string | number) => {
  const s = String(value);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function performanceCsv(p: PartnerPerformance): string {
  const lines: (string | number)[][] = [];
  lines.push(["Partner", p.partnerName]);
  lines.push(["Periode", periodLabel(p)]);
  if (p.onlyTriggered) lines.push(["Filter", "Kun reklamer udløst af produktkategori/-type"]);
  lines.push([]);
  lines.push(["Nøgletal", ""]);
  lines.push(["Visninger", p.totals.impressions]);
  lines.push(["Klik", p.totals.clicks]);
  lines.push(["Klikrate", pct(p.totals.ctr)]);
  lines.push(["Eksponeringstid (sek.)", p.totals.seconds]);
  lines.push(["Gns. eksponering pr. visning (sek.)", p.totals.avgSeconds.toFixed(1).replace(".", ",")]);
  lines.push(["Aftalte visninger", p.totals.agreedImpressions]);
  lines.push(["Opfyldelse", p.totals.fulfilment === null ? "" : pct(p.totals.fulfilment)]);
  lines.push([]);
  lines.push(["Reklamespot", "Placering", "Trigger", "Visninger", "Aftalte visninger", "Klik", "Aftalte klik", "Klikrate", "Eksponeringstid (sek.)"]);
  for (const s of p.spots) {
    lines.push([s.name, s.inventoryName, triggerLabel(s), s.impressions, s.agreedImpressions ?? "", s.clicks, s.agreedClicks ?? "", pct(s.ctr), s.seconds]);
  }
  lines.push([]);
  lines.push(["Reklamespot", "Side (link)", "Visninger", "Klik", "Sekunder eksponeret"]);
  for (const s of p.spots) for (const path of s.paths) lines.push([s.name, path.path, path.impressions, path.clicks, path.seconds]);
  lines.push([]);
  lines.push(["Dato", "Visninger", "Klik"]);
  for (const d of p.byDay) lines.push([d.date, d.impressions, d.clicks]);
  return "﻿" + lines.map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

export function performancePdf(p: PartnerPerformance): Buffer {
  const pdf = new SimplePdf();
  pdf.heading(`Hello Cal – rapport for ${p.partnerName}`, 16);
  pdf.paragraph(`Periode: ${periodLabel(p)}${p.onlyTriggered ? " · Kun reklamer udløst af produktkategori/-type" : ""}`);
  pdf.heading("Nøgletal", 12);
  pdf.table(
    [
      { label: "Nøgletal", width: 260 },
      { label: "Værdi", width: 239, align: "right" },
    ],
    [
      ["Visninger", num(p.totals.impressions)],
      ["Klik", num(p.totals.clicks)],
      ["Klikrate", pct(p.totals.ctr)],
      ["Eksponeringstid", formatSeconds(p.totals.seconds)],
      ["Gns. eksponering pr. visning", `${p.totals.avgSeconds.toFixed(1).replace(".", ",")} sek.`],
      ["Aftalte visninger", num(p.totals.agreedImpressions)],
      ["Opfyldelse af aftalte visninger", p.totals.fulfilment === null ? "–" : pct(p.totals.fulfilment)],
      ["Reklamespots", num(p.totals.spots)],
    ]
  );
  pdf.heading("Reklamespots", 12);
  pdf.table(
    [
      { label: "Spot", width: 150 },
      { label: "Placering", width: 100 },
      { label: "Visninger", width: 70, align: "right" },
      { label: "Aftalt", width: 60, align: "right" },
      { label: "Klik", width: 50, align: "right" },
      { label: "Klikrate", width: 60, align: "right" },
      { label: "Eksp.", width: 60, align: "right" },
    ],
    p.spots.map((s) => [s.name, s.inventoryName, num(s.impressions), s.agreedImpressions === null ? "–" : num(s.agreedImpressions), num(s.clicks), pct(s.ctr), formatSeconds(s.seconds)])
  );
  for (const s of p.spots) {
    if (s.paths.length === 0) continue;
    pdf.heading(`Sider for ${s.name}`, 11);
    pdf.table(
      [
        { label: "Side (link)", width: 300 },
        { label: "Visninger", width: 70, align: "right" },
        { label: "Klik", width: 60, align: "right" },
        { label: "Sekunder", width: 69, align: "right" },
      ],
      s.paths.map((path) => [path.path, num(path.impressions), num(path.clicks), num(path.seconds)])
    );
  }
  return pdf.build();
}

export function performanceFileBase(p: PartnerPerformance) {
  const slug = p.partnerName.toLowerCase().replace(/[^a-z0-9æøå]+/gi, "-").replace(/^-|-$/g, "") || "partner";
  return `hello-cal-${slug}-${p.from.slice(0, 10)}-${new Date(new Date(p.to).getTime() - 1).toISOString().slice(0, 10)}`;
}

// --- Afsendelse til en indtastet modtager ---

export type PerformanceFormat = "pdf" | "csv";

export async function sendPerformanceReport(
  p: PartnerPerformance,
  { toName, toEmail, formats }: { toName: string; toEmail: string; formats: PerformanceFormat[] }
): Promise<{ ok: boolean; message?: string }> {
  const email = toEmail.trim();
  const name = toName.trim();
  if (!name || !isValidEmail(email)) return { ok: false, message: "Angiv navn og gyldig e-mail" };
  if (formats.length === 0) return { ok: false, message: "Vælg mindst ét format" };
  const transport = getReportTransport();
  if (!transport) return { ok: false, message: "SMTP er ikke opsat — rapporten blev ikke sendt" };

  const base = performanceFileBase(p);
  const attachments = formats.map((format) =>
    format === "pdf"
      ? { filename: `${base}.pdf`, content: performancePdf(p), contentType: "application/pdf" }
      : { filename: `${base}.csv`, content: performanceCsv(p), contentType: "text/csv; charset=utf-8" }
  );
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<p>Hej ${esc(name)},</p><p>Vedhæftet er performance-rapporten for <strong>${esc(p.partnerName)}</strong> for perioden ${periodLabel(p)}.</p><p>Visninger: <strong>${num(p.totals.impressions)}</strong> · Klik: <strong>${num(p.totals.clicks)}</strong> · Klikrate: <strong>${pct(p.totals.ctr)}</strong> · Eksponeringstid: <strong>${esc(formatSeconds(p.totals.seconds))}</strong></p><p>Venlig hilsen<br>Hello Cal</p>`;
  const log = { partnerId: p.partnerId, toEmail: email, contactName: name, trigger: "MANUAL_ADDRESS", periodStart: new Date(p.from), periodEnd: new Date(p.to) };
  try {
    await transport.sendMail({
      from: REPORT_FROM,
      headers: NO_TRACKING_HEADERS,
      replyTo: process.env.SMTP_REPLY_TO || DEFAULT_REPLY_TO,
      to: email,
      subject: `Hello Cal – performance for ${p.partnerName} (${periodLabel(p)})`,
      html: wrapEmailHtml(html),
      text: htmlToText(html),
      attachments,
    });
    await prisma.partnerReportSend.create({ data: { ...log, status: "SENT" } });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Ukendt fejl";
    await prisma.partnerReportSend.create({ data: { ...log, status: "FAILED", error: message } });
    return { ok: false, message };
  }
}

import { prisma } from "@/lib/prisma";
import { DOCTOR_SHARE_CATEGORIES, type DoctorShareCategory } from "@/lib/doctor-share";

// Admin "Analyse" → Hello Doc: brug af lægedelingen, målt direkte fra
// databasen (doctor_shares). Der logges ikke, hvornår en læge åbner linket —
// kun invitationer, accept, tilbagekaldelse og hvad der deles.

export type HelloDocAnalytics = {
  totals: { created: number; accepted: number; revoked: number; activeNow: number; pendingNow: number; sharers: number };
  acceptanceRate: number | null;
  medianHoursToAccept: number | null;
  series: { key: string; label: string; created: number; accepted: number }[];
  categories: { key: DoctorShareCategory; count: number }[];
  historyRanges: { key: string; count: number }[];
  statuses: { key: string; count: number }[];
};

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function loadHelloDocAnalytics(spanMs: number): Promise<HelloDocAnalytics> {
  const now = Date.now();
  const since = new Date(now - spanMs);

  const [all, created, accepted] = await Promise.all([
    prisma.doctorShare.findMany({ select: { status: true, categories: true, historyRange: true, ownerId: true, sentAt: true, acceptedAt: true, revokedAt: true } }),
    prisma.doctorShare.findMany({ where: { sentAt: { gte: since } }, select: { sentAt: true, categories: true, historyRange: true, status: true, acceptedAt: true, ownerId: true } }),
    prisma.doctorShare.findMany({ where: { acceptedAt: { gte: since } }, select: { acceptedAt: true, sentAt: true } }),
  ]);

  const revoked = all.filter((s) => s.revokedAt && s.revokedAt >= since).length;

  // Dagsbuckets for hele perioden (mindst 1 dag).
  const days = Math.max(1, Math.round(spanMs / 86400_000));
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dayKey(new Date(now - i * 86400_000)));
  const createdByDay = new Map<string, number>();
  const acceptedByDay = new Map<string, number>();
  for (const s of created) createdByDay.set(dayKey(s.sentAt), (createdByDay.get(dayKey(s.sentAt)) ?? 0) + 1);
  for (const s of accepted) {
    if (!s.acceptedAt) continue;
    acceptedByDay.set(dayKey(s.acceptedAt), (acceptedByDay.get(dayKey(s.acceptedAt)) ?? 0) + 1);
  }
  const series = keys.map((key) => ({
    key,
    label: `${Number(key.slice(8, 10))}/${Number(key.slice(5, 7))}`,
    created: createdByDay.get(key) ?? 0,
    accepted: acceptedByDay.get(key) ?? 0,
  }));

  const categoryCounts = new Map<DoctorShareCategory, number>();
  for (const s of created) {
    if (!Array.isArray(s.categories)) continue;
    for (const c of s.categories) {
      if ((DOCTOR_SHARE_CATEGORIES as readonly string[]).includes(c as string)) {
        categoryCounts.set(c as DoctorShareCategory, (categoryCounts.get(c as DoctorShareCategory) ?? 0) + 1);
      }
    }
  }
  const categories = [...categoryCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  const tally = (values: string[]) => {
    const map = new Map<string, number>();
    for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
    return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  };

  const hours = accepted
    .filter((s) => s.acceptedAt)
    .map((s) => (s.acceptedAt!.getTime() - s.sentAt.getTime()) / 3600_000)
    .sort((a, b) => a - b);
  const medianHoursToAccept = hours.length ? hours[Math.floor(hours.length / 2)] : null;

  return {
    totals: {
      created: created.length,
      accepted: accepted.length,
      revoked,
      activeNow: all.filter((s) => s.status === "ACTIVE").length,
      pendingNow: all.filter((s) => s.status === "PENDING").length,
      sharers: new Set(created.map((s) => s.ownerId)).size,
    },
    acceptanceRate: created.length ? Math.round((created.filter((s) => s.acceptedAt).length / created.length) * 100) : null,
    medianHoursToAccept,
    series,
    categories,
    historyRanges: tally(created.map((s) => s.historyRange)),
    statuses: tally(all.map((s) => s.status)),
  };
}

import { prisma } from "@/lib/prisma";
import { JOBS } from "@/lib/jobs/registry";
import { sendTransientMail } from "@/lib/transient-mail";
import { escapeHtml } from "@/lib/admin-access";

// Admin-advarsler (docs/DECISIONS.md 2026-10-17): banner øverst i Admin og
// advarselsmail, når noget er galt — OpenAI-betaling/nøgle, integrationer der
// ikke virker, og kørsler (jobs/robotter) der fejler eller står stille, så
// varer ikke bliver genkendt. Hver admin vælger selv mail under
// "Mine advarselsmails" (User.adminWarningEmails).

export type AdminWarning = {
  key: string;
  title: string;
  detail: string;
  href: string;
};

const HOUR = 60 * 60 * 1000;
const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || "https://admin.hellocal.io";
const MAIL_REPEAT_MS = 24 * HOUR;

const QUOTA_PATTERN = /insufficient_quota|billing|exceeded your current quota|payment|credit|402/i;
const AUTH_PATTERN = /401|invalid_api_key|incorrect api key|OPENAI_API_KEY er ikke sat/i;

async function openAiWarnings(now: Date): Promise<AdminWarning[]> {
  const since = new Date(now.getTime() - 6 * HOUR);
  const logs = await prisma.debugLog.findMany({
    where: { category: "ai", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { level: true, message: true },
  });
  const errors = logs.filter((l) => l.level === "error");
  // Kun hvis det seneste AI-kald fejlede — ellers er problemet væk igen.
  if (errors.length === 0 || logs[0]?.level !== "error") return [];
  const sample = errors[0].message;
  if (errors.some((l) => QUOTA_PATTERN.test(l.message))) {
    return [{ key: "openai-billing", title: "OpenAI: betalingen er ved at løbe ud eller udløbet", detail: `Varer bliver ikke genkendt. ${sample.slice(0, 200)}`, href: "/admin/api-keys" }];
  }
  if (errors.some((l) => AUTH_PATTERN.test(l.message))) {
    return [{ key: "openai-key", title: "OpenAI: API-nøglen virker ikke", detail: `Varer bliver ikke genkendt. ${sample.slice(0, 200)}`, href: "/admin/api-keys" }];
  }
  return [{ key: "openai-errors", title: `OpenAI-kald fejler (${errors.length} seneste 6 timer)`, detail: `Varer bliver ikke genkendt. ${sample.slice(0, 200)}`, href: "/admin/log" }];
}

async function integrationWarnings(): Promise<AdminWarning[]> {
  const broken = await prisma.integration.groupBy({ by: ["provider"], where: { status: "ERROR" }, _count: { _all: true } });
  return broken.map((b) => ({
    key: `integration-${b.provider}`,
    title: `Integration virker ikke: ${b.provider} (${b._count._all} brugere)`,
    detail: "Synkroniseringen fejler for brugere med denne integration.",
    href: "/admin/api-keys",
  }));
}

async function jobWarnings(now: Date): Promise<AdminWarning[]> {
  const rows = await prisma.scheduledJob.findMany({ where: { enabled: true } });
  const out: AdminWarning[] = [];
  for (const row of rows) {
    const job = JOBS.find((j) => j.key === row.key);
    if (!job) continue;
    if (row.lastStatus === "ERROR") {
      out.push({ key: `job-error-${row.key}`, title: `Kørsel fejler: ${job.name}`, detail: (row.lastMessage ?? "Ukendt fejl").slice(0, 200), href: "/admin/cron-jobs" });
      continue;
    }
    if (!row.lastRunAt) continue;
    const interval = row.intervalMinutes ?? null;
    const maxAge = interval ? Math.max(interval * 3 * 60_000, HOUR) : 26 * HOUR;
    if (now.getTime() - row.lastRunAt.getTime() > maxAge) {
      out.push({ key: `job-stale-${row.key}`, title: `Kørsel står stille: ${job.name}`, detail: `Sidst kørt ${row.lastRunAt.toISOString().slice(0, 16).replace("T", " ")} UTC.`, href: "/admin/cron-jobs" });
    }
  }
  return out;
}

async function imageJobWarnings(now: Date): Promise<AdminWarning[]> {
  const failed = await prisma.imageCutoutJob.count({ where: { status: "FAILED", createdAt: { gte: new Date(now.getTime() - 24 * HOUR) } } });
  return failed >= 3
    ? [{ key: "image-jobs-failed", title: `${failed} billed-/logo-genkendelser fejlede seneste døgn`, detail: "Navne/logoer bliver ikke genkendt.", href: "/admin/logos" }]
    : [];
}

// Allergen-robottens rapport (docs/DECISIONS.md 2026-10-17): nye ord fra det
// seneste døgn og ord, der venter på admin.
async function allergenWordWarnings(now: Date): Promise<AdminWarning[]> {
  const [fresh, pending] = await Promise.all([
    prisma.allergenWord.findMany({
      where: { firstSeenAt: { gte: new Date(now.getTime() - 24 * HOUR) } },
      orderBy: { productCount: "desc" },
      take: 20,
      select: { word: true },
    }),
    prisma.allergenWord.count({ where: { status: "PENDING" } }),
  ]);
  // Kun når der er nye ord — ventende ord alene giver ikke en daglig mail.
  if (!fresh.length) return [];
  const words = fresh.map((row) => row.word.toUpperCase()).join(", ");
  return [
    {
      key: `allergen-words-${now.toISOString().slice(0, 10)}`,
      title: `Allergen-robotten fandt ${fresh.length} nye ord`,
      detail: `Nye ord: ${words}. ${pending} venter på gennemsyn.`,
      href: "/admin/allergen-words",
    },
  ];
}

export async function getAdminWarnings(now: Date = new Date()): Promise<AdminWarning[]> {
  const parts = await Promise.all([openAiWarnings(now), integrationWarnings(), jobWarnings(now), imageJobWarnings(now), allergenWordWarnings(now)].map((p) => p.catch(() => [] as AdminWarning[])));
  return parts.flat();
}

// Kaldes fra scheduleren: mail hver advarsel til de admins, der har det slået til.
export async function mailAdminWarnings(now: Date = new Date()) {
  const warnings = await getAdminWarnings(now);
  if (warnings.length === 0) return { sent: 0 };
  const states = await prisma.adminWarningMail.findMany({ where: { key: { in: warnings.map((w) => w.key) } } });
  const lastByKey = new Map(states.map((s) => [s.key, s.lastMailedAt.getTime()]));
  const due = warnings.filter((w) => now.getTime() - (lastByKey.get(w.key) ?? 0) > MAIL_REPEAT_MS);
  if (due.length === 0) return { sent: 0 };

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", adminDisabledAt: null, adminWarningEmails: true },
    select: { email: true },
  });
  const recipients = admins.map((a) => a.email).filter((e): e is string => !!e);
  if (recipients.length === 0) return { sent: 0 };

  const items = due
    .map((w) => `<li><strong>${escapeHtml(w.title)}</strong><br>${escapeHtml(w.detail)}<br><a href="${ADMIN_BASE_URL}${w.href}">Åbn i Admin</a></li>`)
    .join("");
  const html = `<p>Der er ${due.length} advarsel${due.length === 1 ? "" : "er"} i HELLO CAL Admin:</p><ul>${items}</ul><p>Du kan slå disse mails fra under Admin → Mine advarselsmails.</p>`;
  for (const to of recipients) {
    await sendTransientMail({ to, subject: `HELLO CAL Admin: ${due.length} advarsel${due.length === 1 ? "" : "er"}`, html });
  }
  for (const w of due) {
    await prisma.adminWarningMail.upsert({ where: { key: w.key }, create: { key: w.key, lastMailedAt: now }, update: { lastMailedAt: now } });
  }
  return { sent: recipients.length };
}

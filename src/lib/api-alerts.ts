import { prisma } from "@/lib/prisma";
import { APP_BASE_URL, sendTransientMail } from "@/lib/transient-mail";
import { getApiUsageOverview, type ServiceOverview } from "@/lib/api-usage";

// Varsler om API-forbrug (docs/DECISIONS.md 2026-10-16): job `api-alerts`
// mailer modtagerne, når en betalt tjeneste fejler, kreditten slipper op,
// eller månedens budget når 80 % / 100 %. Hvert varsel sendes én gang:
// fejl højst én gang i døgnet, budgetvarsler én gang pr. måned.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KEEP_SENT_DAYS = 40;

export type AlertSettings = { enabled: boolean; emails: string[] };

export async function loadAlertSettings(): Promise<AlertSettings> {
  const row = await prisma.apiAlertSettings.findUnique({ where: { id: "default" } });
  return { enabled: row?.enabled ?? true, emails: row?.emails ?? [] };
}

export function cleanEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return EMAIL_PATTERN.test(email) && email.length <= 200 ? email : null;
}

export async function saveAlertSettings(settings: AlertSettings) {
  const emails = [...new Set(settings.emails.map(cleanEmail).filter((e): e is string => Boolean(e)))].slice(0, 20);
  await prisma.apiAlertSettings.upsert({
    where: { id: "default" },
    create: { id: "default", enabled: settings.enabled, emails },
    update: { enabled: settings.enabled, emails },
  });
  return { enabled: settings.enabled, emails };
}

type Alert = { key: string; text: string };

function alertsFor(service: ServiceOverview, month: string, day: string): Alert[] {
  const alerts: Alert[] = [];
  if (service.state === "fail" && (service.budgetUse === null || service.budgetUse < 1)) {
    alerts.push({ key: `${service.id}:fail:${day}`, text: `${service.name}: ${service.stateText}` });
  }
  if (service.budgetUse !== null && service.budget) {
    const spent = `${service.spent?.toFixed(2)} af ${service.budget.toFixed(2)} ${service.currency}`;
    if (service.budgetUse >= 1) {
      alerts.push({ key: `${service.id}:budget100:${month}`, text: `${service.name}: budgettet er brugt op (${spent}).` });
    } else if (service.budgetUse >= 0.8) {
      alerts.push({ key: `${service.id}:budget80:${month}`, text: `${service.name}: 80 % af budgettet er brugt (${spent}).` });
    }
  }
  if (service.id === "openai" && service.state === "warn" && /saldo/i.test(service.stateText)) {
    alerts.push({ key: `openai:low:${day}`, text: `OpenAI: ${service.stateText}.` });
  }
  return alerts;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

async function mailAll(emails: string[], subject: string, lines: string[]) {
  const html = `<p>${lines.map(escapeHtml).join("<br>")}</p><p><a href="${APP_BASE_URL}/admin/api-usage">Åbn API-forbrug i admin</a></p>`;
  let sent = 0;
  for (const to of emails) {
    try {
      await sendTransientMail({ to, subject, html });
      sent += 1;
    } catch (error) {
      console.error("[api-alerts] mail fejlede", error instanceof Error ? error.message : error);
    }
  }
  return sent;
}

export async function sendTestAlert(emails: string[]) {
  return mailAll(emails, "Hello Cal: test af API-varsler", ["Varslerne om API-forbrug virker. Denne mail er kun en test."]);
}

// Kørt af jobbet `api-alerts` (src/lib/scheduler.ts).
export async function runApiAlerts(now = new Date()) {
  const settings = await prisma.apiAlertSettings.findUnique({ where: { id: "default" } });
  if (settings && !settings.enabled) return { message: "Varsler er slået fra" };
  if (!settings?.emails.length) return { message: "Ingen modtagere" };

  const overview = await getApiUsageOverview(now);
  const day = now.toISOString().slice(0, 10);
  const sentMap = { ...((settings.sent as Record<string, string> | null) ?? {}) };
  const fresh = overview.services.flatMap((s) => alertsFor(s, overview.month, day)).filter((a) => !sentMap[a.key]);
  if (fresh.length === 0) return { message: "Intet nyt at varsle" };

  const sent = await mailAll(
    settings.emails,
    fresh.length === 1 ? `Hello Cal: ${fresh[0].text}` : `Hello Cal: ${fresh.length} varsler om API'er`,
    fresh.map((a) => a.text),
  );
  if (sent === 0) return { message: "Varslerne kunne ikke sendes (SMTP?)" };

  const cutoff = now.getTime() - KEEP_SENT_DAYS * 86_400_000;
  for (const [key, at] of Object.entries(sentMap)) if (new Date(at).getTime() < cutoff) delete sentMap[key];
  for (const alert of fresh) sentMap[alert.key] = now.toISOString();
  await prisma.apiAlertSettings.update({ where: { id: "default" }, data: { sent: sentMap } });
  return { message: `${fresh.length} varsler sendt til ${sent} modtagere` };
}

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ensureDefaultMessageTemplates } from "@/lib/messaging";
import { MessageTemplateRow } from "@/components/admin/MessageTemplateRow";
import { t } from "@/lib/admin-i18n";

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "I kø",
  SENT: "Sendt",
  FAILED: "Fejlet",
  SKIPPED: "Sprunget over",
};

// "Besked automatisering" (docs/DECISIONS.md 2026-09-02): mail- og
// push-skabeloner pr. event samt en log over seneste forsøg. Reel
// afsendelse er forberedt (src/lib/mailer.ts, src/lib/push.ts) men no-op
// indtil SMTP/VAPID-miljøvariabler er sat — se docs/DEPLOYMENT.md.
export default async function AdminMessagingPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  await ensureDefaultMessageTemplates();

  const [templates, recentMessages, smtpConfigured, pushConfigured] = await Promise.all([
    prisma.messageTemplate.findMany({ orderBy: { event: "asc" } }),
    prisma.outboundMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { displayName: true, email: true } } },
    }),
    Promise.resolve(Boolean(process.env.SMTP_HOST)),
    Promise.resolve(Boolean(process.env.VAPID_PUBLIC_KEY)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{t(admin.locale, "messaging_title")}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Styr indhold og kanal for automatiske mails og pushbeskeder.
        </p>
        <p className="mt-2 text-xs text-text-muted">
          SMTP: {smtpConfigured ? "opsat" : "IKKE opsat — beskeder lægges i kø, men sendes ikke"} ·
          Web Push: {pushConfigured ? "opsat" : "IKKE opsat — beskeder lægges i kø, men sendes ikke"}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        {templates.map((t) => (
          <MessageTemplateRow
            key={t.event}
            template={{
              event: t.event,
              channel: t.channel,
              enabled: t.enabled,
              subject: t.subject,
              bodyHtml: t.bodyHtml,
            }}
          />
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Seneste beskeder
        </h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-strong text-xs uppercase tracking-wide text-text-muted">
                <th className="py-2 pr-3">Event</th>
                <th className="py-2 pr-3">Til</th>
                <th className="py-2 pr-3">Kanal</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Tidspunkt</th>
              </tr>
            </thead>
            <tbody>
              {recentMessages.map((m) => (
                <tr key={m.id} className="border-b border-border-strong">
                  <td className="py-2 pr-3">{m.event}</td>
                  <td className="py-2 pr-3 text-text-secondary">{m.toEmail ?? m.user?.email ?? "—"}</td>
                  <td className="py-2 pr-3 text-text-secondary">{m.channel}</td>
                  <td className="py-2 pr-3 text-text-secondary">{STATUS_LABELS[m.status] ?? m.status}</td>
                  <td className="py-2 text-xs text-text-muted">
                    {m.createdAt.toLocaleString("da-DK")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentMessages.length === 0 && (
            <p className="py-4 text-sm text-text-secondary">Ingen beskeder sendt endnu.</p>
          )}
        </div>
      </section>
    </div>
  );
}

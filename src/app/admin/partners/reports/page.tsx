import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { reportRecipients } from "@/lib/partner-reports";
import { ReportsManager } from "@/components/admin/ReportsManager";

export const dynamic = "force-dynamic";

// Admin "Rapporter" (docs/DECISIONS.md 2026-09-29): send rapporter til
// partneres kontakter fra report@hellocal.io — straks eller på interval.
export default async function ReportsPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const partners = await prisma.partner.findMany({ orderBy: { name: "asc" }, include: { schedules: true } });
  const withRecipients = await Promise.all(
    partners.map(async (p) => ({
      id: p.id,
      name: p.name,
      recipients: (await reportRecipients(p.id)).map((c) => ({ name: c.name, email: c.email.trim() })),
      schedules: p.schedules.map((s) => ({
        id: s.id,
        frequency: s.frequency,
        enabled: s.enabled,
        nextRunAt: s.nextRunAt.toISOString(),
        lastSentAt: s.lastSentAt?.toISOString() ?? null,
      })),
    }))
  );
  const sends = await prisma.partnerReportSend.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { partner: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">Rapporter</h1>
      <ReportsManager partners={withRecipients} />
      <div className="hf-panel">
        <p className="hf-type-strong mb-2 text-hf-black">Seneste afsendelser</p>
        {sends.length === 0 && <p className="hf-type-small text-text-muted">Ingen endnu.</p>}
        <ul className="hf-type-small flex flex-col gap-1 text-text-secondary">
          {sends.map((s) => (
            <li key={s.id}>
              {s.createdAt.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })} · {s.partner.name} → {s.toEmail} ·{" "}
              {s.trigger === "SCHEDULE" ? "interval" : "manuel"} · {s.status === "SENT" ? "sendt" : `fejlet${s.error ? `: ${s.error}` : ""}`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

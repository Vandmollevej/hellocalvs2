import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePartnerUser } from "@/lib/partner/require-partner";
import { getPartnerStats } from "@/lib/partner-reports";
import { PartnerLogoutButton } from "@/components/partner/PartnerLogoutButton";

export const dynamic = "force-dynamic";

const PERIODS = [
  { days: 7, label: "7 dage" },
  { days: 30, label: "30 dage" },
  { days: 90, label: "90 dage" },
];

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const fmt = (d: Date) => d.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "short" });
const fmtDate = (d: Date) => d.toLocaleDateString("da-DK", { timeZone: "Europe/Copenhagen", dateStyle: "short" });

// Partnerportalens forside (docs/DECISIONS.md 2026-10-02): B2B-brugeren ser
// KUN sin egen partners data — partnerId kommer fra sessionen, aldrig fra
// klienten. Samme tal som admin → Partnere → Reklamer og rapport-mailene.
export default async function PartnerHomePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await requirePartnerUser();
  if (!user) redirect("/partner/login");

  const { days: daysParam } = await searchParams;
  const days = PERIODS.some((p) => String(p.days) === daysParam) ? Number(daysParam) : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const [stats, sends, contacts] = await Promise.all([
    getPartnerStats(user.partnerId, from, to),
    prisma.partnerReportSend.findMany({
      where: { partnerId: user.partnerId, status: "SENT" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.partnerContact.findMany({ where: { partnerId: user.partnerId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="hf-type-title text-hf-black">{user.partner.name}</h1>
          <p className="hf-type-body text-text-secondary">
            Logget ind som {user.name} ({user.email})
          </p>
        </div>
        <PartnerLogoutButton />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="hf-type-body hf-type-strong">Jeres placeringer i appen</h2>
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <Link
                key={p.days}
                href={`/partner?days=${p.days}`}
                className={`hf-type-small rounded-md border border-hf-tan-dark px-3 py-1.5 ${p.days === days ? "bg-hf-black text-hf-white" : "text-text-secondary hover:bg-hf-tan"}`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
        {!stats || stats.locations.length === 0 ? (
          <p className="hf-type-body text-text-secondary hf-panel">
            Der er endnu ingen placeringer registreret for jer. Kontakt Hello Cal, hvis det er en fejl.
          </p>
        ) : (
          <div className="overflow-x-auto hf-panel">
            <table className="hf-type-body w-full text-left">
              <thead>
                <tr className="hf-type-small border-b border-hf-tan-dark uppercase tracking-wide text-text-muted">
                  <th className="py-2 pr-3">Lokation</th>
                  <th className="py-2 pr-3">Placering</th>
                  <th className="py-2 pr-3 text-right">Visninger</th>
                  <th className="py-2 pr-3 text-right">Klik</th>
                  <th className="py-2 text-right">Klikrate</th>
                </tr>
              </thead>
              <tbody>
                {stats.locations.map((location) => (
                  <tr key={location.id} className="border-b border-border-strong/40">
                    <td className="py-2 pr-3">{location.name}</td>
                    <td className="py-2 pr-3 text-text-secondary">{location.placement || "—"}</td>
                    <td className="py-2 pr-3 text-right">{location.impressions.toLocaleString("da-DK")}</td>
                    <td className="py-2 pr-3 text-right">{location.clicks.toLocaleString("da-DK")}</td>
                    <td className="py-2 text-right">{pct(location.ctr)}</td>
                  </tr>
                ))}
                <tr className="hf-type-strong">
                  <td className="py-2 pr-3" colSpan={2}>
                    I alt
                  </td>
                  <td className="py-2 pr-3 text-right">{stats.impressions.toLocaleString("da-DK")}</td>
                  <td className="py-2 pr-3 text-right">{stats.clicks.toLocaleString("da-DK")}</td>
                  <td className="py-2 text-right">{pct(stats.impressions > 0 ? stats.clicks / stats.impressions : 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="hf-type-body hf-type-strong">Seneste rapporter</h2>
          {sends.length === 0 ? (
            <p className="hf-type-small text-text-secondary">Der er ikke sendt rapporter endnu.</p>
          ) : (
            <ul className="hf-type-small gap-1 hf-panel">
              {sends.map((send) => (
                <li key={send.id}>
                  {fmt(send.createdAt)} · {fmtDate(send.periodStart)}–{fmtDate(send.periodEnd)} · til {send.contactName}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="hf-type-body hf-type-strong">Modtagere af rapporter</h2>
          {contacts.length === 0 ? (
            <p className="hf-type-small text-text-secondary">Ingen modtagere registreret. Kontakt Hello Cal for at få tilføjet nogen.</p>
          ) : (
            <ul className="hf-type-small gap-1 hf-panel">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  {contact.name} · {contact.email}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

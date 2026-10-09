import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { getPartnerStats } from "@/lib/partner-reports";
import { DeleteLocationButton, LocationForm } from "@/components/admin/PartnerManagers";

export const dynamic = "force-dynamic";

const PERIODS = [
  { days: 7, label: "7 dage" },
  { days: 30, label: "30 dage" },
  { days: 90, label: "90 dage" },
];

// Admin Partnere → Reklamer (docs/DECISIONS.md 2026-09-29): oversigt over
// lokationer med visninger, klik og klikrate pr. lokation.
export default async function AdsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { days: daysParam } = await searchParams;
  const days = PERIODS.some((p) => String(p.days) === daysParam) ? Number(daysParam) : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const partners = await prisma.partner.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const stats = (await Promise.all(partners.map((p) => getPartnerStats(p.id, from, to)))).filter((s) => s !== null);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">Reklamer</h1>
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.days}
            href={`/admin/partners/ads?days=${p.days}`}
            className={`hf-type-small rounded-md border border-hf-tan-dark px-3 py-1.5 ${p.days === days ? "bg-hf-black text-hf-white" : "text-text-secondary hover:bg-hf-tan"}`}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <LocationForm partners={partners} />
      {stats.length === 0 && <p className="hf-type-body text-text-secondary">Opret først en partner under Kontakter.</p>}
      {stats.map((partner) => (
        <div key={partner.partnerId} className="overflow-x-auto hf-panel">
          <p className="hf-type-strong mb-2 text-hf-black">{partner.partnerName}</p>
          <table className="hf-type-body w-full text-left">
            <thead>
              <tr className="text-text-secondary">
                <th className="py-1 pr-3">Lokation</th>
                <th className="py-1 pr-3">Placering</th>
                <th className="py-1 pr-3 text-right">Visninger</th>
                <th className="py-1 pr-3 text-right">Klik</th>
                <th className="py-1 pr-3 text-right">Klikrate</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {partner.locations.map((l) => (
                <tr key={l.id} className="border-t border-hf-tan-dark">
                  <td className="py-1 pr-3">{l.name}</td>
                  <td className="py-1 pr-3 text-text-secondary">{l.placement || "—"}</td>
                  <td className="py-1 pr-3 text-right">{l.impressions}</td>
                  <td className="py-1 pr-3 text-right">{l.clicks}</td>
                  <td className="py-1 pr-3 text-right">{(l.ctr * 100).toFixed(1).replace(".", ",")} %</td>
                  <td className="py-1 text-right"><DeleteLocationButton id={l.id} name={l.name} /></td>
                </tr>
              ))}
              {partner.locations.length === 0 && (
                <tr className="border-t border-hf-tan-dark"><td colSpan={6} className="py-1 text-text-muted">Ingen lokationer.</td></tr>
              )}
              <tr className="border-t-2 border-hf-tan-dark hf-type-strong">
                <td className="py-1 pr-3" colSpan={2}>I alt</td>
                <td className="py-1 pr-3 text-right">{partner.impressions}</td>
                <td className="py-1 pr-3 text-right">{partner.clicks}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

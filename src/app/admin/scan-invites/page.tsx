import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { formatKroner } from "@/lib/scan/weeks";
import { SCAN_APP_BASE_URL } from "@/lib/scan/invites";
import { inviteWorker, saveRejectionReason, updatePayRate } from "./actions";

// Admin "scan-invites" (docs/OPRETTELSES-APP.md): invitér medarbejdere til
// Oprettelses-appen, se oversigt over alle medarbejdere, global sats og
// redigerbare afvisningsårsager.
const STATUS_LABEL = { INVITED: "Inviteret", ACTIVE: "Aktiv", DISABLED: "Deaktiveret" } as const;

export default async function ScanInvitesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { error } = await searchParams;

  const [workers, settings, reasons, pendingByWorker, unreadByWorker] = await Promise.all([
    prisma.scanWorker.findMany({ orderBy: { invitedAt: "desc" }, include: { _count: { select: { submissions: true } } } }),
    prisma.scanSettings.findUnique({ where: { id: 1 } }),
    prisma.scanRejectionReason.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.scanSubmission.groupBy({ by: ["workerId"], where: { reviewStatus: "PENDING" }, _count: { _all: true } }),
    prisma.scanMessage.groupBy({ by: ["workerId"], where: { fromAdmin: false, readAt: null }, _count: { _all: true } }),
  ]);
  const pending = new Map(pendingByWorker.map((row) => [row.workerId, row._count._all]));
  const unread = new Map(unreadByWorker.map((row) => [row.workerId, row._count._all]));
  const rate = settings?.payPerItemOre ?? 100;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hf-type-title text-hf-black">scan-invites</h1>
        <p className="hf-type-body text-text-secondary">
          Medarbejdere i Oprettelses-appen ({SCAN_APP_BASE_URL}). Kun inviterede kan logge ind.
        </p>
      </div>

      <form action={inviteWorker} className="flex flex-col gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4 sm:flex-row sm:items-end">
        <label className="hf-type-body flex flex-1 flex-col gap-1">
          Navn
          <input name="name" required className="rounded border border-hf-tan-dark bg-page-bg px-3 py-2" />
        </label>
        <label className="hf-type-body flex flex-1 flex-col gap-1">
          E-mail
          <input name="email" type="email" required className="rounded border border-hf-tan-dark bg-page-bg px-3 py-2" />
        </label>
        <button type="submit" className="hf-btn-primary px-4 py-2">
          Send invitation
        </button>
      </form>
      {error === "invalid" && <p className="hf-type-body text-[var(--hf-color-danger)]">Udfyld navn og en gyldig e-mail.</p>}

      <div className="overflow-x-auto">
        <table className="hf-type-body w-full text-left">
          <thead>
            <tr className="hf-type-small border-b border-hf-tan-dark uppercase tracking-wide text-text-muted">
              <th className="py-2 pr-3">Medarbejder</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Varer i alt</th>
              <th className="py-2 pr-3">Afventer gennemsyn</th>
              <th className="py-2">Beskeder</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <tr key={worker.id} className="border-b border-border-strong/50">
                <td className="py-2 pr-3">
                  <Link href={`/admin/scan-invites/${worker.id}`} className="hf-type-strong text-hf-green-dark underline">
                    {worker.name}
                  </Link>
                  <div className="hf-type-small text-text-secondary">
                    {worker.email}
                    {worker.username ? ` · @${worker.username}` : ""}
                  </div>
                </td>
                <td className="py-2 pr-3">{STATUS_LABEL[worker.status]}</td>
                <td className="py-2 pr-3">{worker._count.submissions}</td>
                <td className="py-2 pr-3">{pending.get(worker.id) ?? 0}</td>
                <td className="py-2">{unread.get(worker.id) ? `${unread.get(worker.id)} ulæste` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {workers.length === 0 && <p className="hf-type-body py-4 text-text-secondary">Ingen medarbejdere inviteret endnu.</p>}
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <form action={updatePayRate} className="flex flex-col gap-2 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
          <h2 className="hf-type-body hf-type-strong">Sats pr. godkendt vare (alle medarbejdere)</h2>
          <p className="hf-type-small text-text-secondary">
            Nu: {formatKroner(rate)}. Ændringer gælder kun nye indsendelser — tidligere beløb er fastfrosset.
          </p>
          <div className="flex gap-2">
            <input
              name="kroner"
              defaultValue={(rate / 100).toFixed(2).replace(".", ",")}
              inputMode="decimal"
              className="w-28 rounded border border-hf-tan-dark bg-page-bg px-3 py-2"
            />
            <button type="submit" className="hf-type-body rounded border border-hf-tan-dark px-3 py-2">
              Gem
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-2 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
          <h2 className="hf-type-body hf-type-strong">Afvisningsårsager</h2>
          {reasons.map((reason) => (
            <form key={reason.id} action={saveRejectionReason} className="flex items-center gap-2">
              <input type="hidden" name="id" value={reason.id} />
              <input name="label" defaultValue={reason.label} className="hf-type-body flex-1 rounded border border-hf-tan-dark bg-page-bg px-2 py-1" />
              <label className="hf-type-small flex items-center gap-1">
                <input type="checkbox" name="active" defaultChecked={reason.active} /> aktiv
              </label>
              <button type="submit" className="hf-type-small rounded border border-hf-tan-dark px-2 py-1">
                Gem
              </button>
            </form>
          ))}
          <form action={saveRejectionReason} className="flex gap-2">
            <input name="label" placeholder="Ny årsag" className="hf-type-body flex-1 rounded border border-hf-tan-dark bg-page-bg px-2 py-1" />
            <button type="submit" className="hf-type-small rounded border border-hf-tan-dark px-2 py-1">
              Tilføj
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

import { redirect } from "next/navigation";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { WeekAccordions } from "@/components/scan/WeekAccordions";
import { requireScanWorker } from "@/lib/scan/require-worker";
import { loadWorkerSubmissions, toWeekGroups } from "@/lib/scan/history";
import { formatKroner } from "@/lib/scan/weeks";

export default async function ScanHistorikPage() {
  const worker = await requireScanWorker();
  if (!worker) redirect("/scan/login");

  const rows = await loadWorkerSubmissions(worker.id, false);
  const paidOre = rows.filter((row) => row.payoutId && row.payable).reduce((sum, row) => sum + row.amountOre, 0);
  const groups = toWeekGroups(rows, (row) => (row.payoutId && row.payable ? row.amountOre : 0), "Udbetalt");

  return (
    <ScanScreen title="Historik" showBack>
      <div className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[12px] p-4" style={{ background: "var(--hf-color-card)" }}>
            <p className="hf-type-section-title">{rows.length}</p>
            <p className="hf-type-caption">Oprettede produkter</p>
          </div>
          <div className="rounded-[12px] p-4" style={{ background: "var(--hf-color-card)" }}>
            <p className="hf-type-section-title">{formatKroner(paidOre)}</p>
            <p className="hf-type-caption">Udbetalt i alt</p>
          </div>
        </div>
        <WeekAccordions groups={groups} emptyText="Du har ikke oprettet nogen varer endnu." />
      </div>
    </ScanScreen>
  );
}

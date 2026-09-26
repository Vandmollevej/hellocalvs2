import { redirect } from "next/navigation";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { WeekAccordions } from "@/components/scan/WeekAccordions";
import { requireScanWorker } from "@/lib/scan/require-worker";
import { loadWorkerSubmissions, toWeekGroups } from "@/lib/scan/history";

// Som Historik, men kun ikke-udbetalte varer og med butikken ude til højre.
export default async function ScanIkkeAfregnetPage() {
  const worker = await requireScanWorker();
  if (!worker) redirect("/scan/login");

  const rows = await loadWorkerSubmissions(worker.id, true);
  const groups = toWeekGroups(rows, (row) => row.amountOre, "Til udbetaling");

  return (
    <ScanScreen title="Ikke afregnet" showBack>
      <div className="p-4">
        <WeekAccordions groups={groups} showStore emptyText="Alt er afregnet." />
      </div>
    </ScanScreen>
  );
}

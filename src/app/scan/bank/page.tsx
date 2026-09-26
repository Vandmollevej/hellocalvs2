import { redirect } from "next/navigation";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { InfoRows } from "@/components/scan/InfoRows";
import { requireScanWorker } from "@/lib/scan/require-worker";
import { decryptPii, maskTail } from "@/lib/scan/pii";

export default async function ScanBankPage() {
  const worker = await requireScanWorker();
  if (!worker) redirect("/scan/login");

  return (
    <ScanScreen title="Bankoplysninger" showBack>
      <InfoRows
        rows={[
          ["Bankforbindelse", worker.bankName],
          ["Reg.nr.", decryptPii(worker.bankRegNoEnc)],
          ["Kontonummer", maskTail(decryptPii(worker.bankAccountEnc))],
          ["PayPal", worker.paypalEmail],
        ]}
        note="Udbetaling sker til bankkontoen eller PayPal-kontoen. Oplysningerne kan kun ændres af Hello Cal."
      />
    </ScanScreen>
  );
}

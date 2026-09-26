import { redirect } from "next/navigation";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { InfoRows } from "@/components/scan/InfoRows";
import { requireScanWorker } from "@/lib/scan/require-worker";
import { decryptPii, maskTail } from "@/lib/scan/pii";
import { ageFromBirthDate } from "@/lib/scan/age";

export default async function ScanProfilPage() {
  const worker = await requireScanWorker();
  if (!worker) redirect("/scan/login");

  return (
    <ScanScreen title="Profil" showBack>
      <InfoRows
        rows={[
          ["Navn", worker.name],
          ["Brugernavn", worker.username],
          ["E-mail", worker.email],
          ["Telefon", worker.phone],
          ["Adresse", worker.address],
          ["Alder", worker.birthDate ? `${ageFromBirthDate(worker.birthDate)} år` : null],
          ["Køn", worker.gender],
          ["CPR-nummer", maskTail(decryptPii(worker.cprEnc))],
        ]}
        note="Oplysningerne kan kun ændres af Hello Cal. Skriv under Beskeder, hvis noget er forkert."
      />
    </ScanScreen>
  );
}

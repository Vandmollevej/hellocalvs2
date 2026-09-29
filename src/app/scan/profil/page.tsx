import { redirect } from "next/navigation";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { InfoRows } from "@/components/scan/InfoRows";
import { requireScanWorker } from "@/lib/scan/require-worker";
import { decryptPii, maskTail } from "@/lib/scan/pii";
import { ageFromBirthDate } from "@/lib/scan/age";
import { prisma } from "@/lib/prisma";
import { ScanPasskeySection } from "@/components/scan/ScanPasskeySection";

export default async function ScanProfilPage() {
  const worker = await requireScanWorker();
  if (!worker) redirect("/scan/login");
  const passkeys = await prisma.scanWorkerPasskey.findMany({
    where: { workerId: worker.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, lastUsedAt: true },
  });

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
      <ScanPasskeySection passkeys={passkeys.map((p) => ({ ...p, lastUsedAt: p.lastUsedAt?.toISOString() ?? null }))} />
    </ScanScreen>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/hf/ScreenHeader";

// Placeholder — intet betalings-/abonnementssystem findes endnu (ingen
// konto-login for almindelige brugere, se docs/STATUS.md "Next work").
export default function BetalingPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Betaling" onBack={() => router.back()} />

      <div className="flex flex-col gap-3 p-4">
        <div className="rounded-[8px] bg-hf-tan p-4 text-center">
          <p className="text-[15px] font-bold text-hf-black">Betaling er ikke sat op endnu</p>
          <p className="mt-1 text-[13px] text-hf-black opacity-60">
            Kommer, når Hello Cal får sit eget konto- og abonnementssystem.
          </p>
        </div>
      </div>
    </div>
  );
}

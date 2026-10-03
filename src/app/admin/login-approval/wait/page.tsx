"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Ny enhed: venter på, at brugeren godkender linket i sin mail (op til 15 min.).
export default function AdminLoginApprovalWaitPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch("/api/admin/login-approval/status", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (stopped) return;
        if (data.status === "approved") {
          router.push("/admin");
          router.refresh();
          return;
        }
        if (data.status === "expired") {
          setMessage("Godkendelsen er udløbet. Log ind igen.");
          return;
        }
        if (data.status === "blocked") {
          setMessage("Login er ikke tilladt fra denne forbindelse.");
          return;
        }
      } catch {
        // netværksfejl: prøv igen
      }
      if (!stopped) setTimeout(poll, 3000);
    }
    poll();
    return () => {
      stopped = true;
    };
  }, [router]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <h1 className="hf-type-title mb-1 text-hf-black">Godkend dette udstyr</h1>
      <p className="hf-type-body mb-6 text-text-secondary">
        Vi har sendt et link til din e-mail. Åbn det og godkend, at det er dig — så fortsætter du automatisk her.
        Linket virker i 15 minutter.
      </p>
      {message ? (
        <p className="hf-type-body text-hf-red-dark">{message}</p>
      ) : (
        <p className="hf-type-body text-text-muted">Venter på godkendelse…</p>
      )}
      <Link href="/admin/login" className="hf-type-body mt-4 text-center text-hf-green-dark underline">
        Tilbage til login
      </Link>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PartnerCodeInput } from "@/components/partner/PartnerCodeInput";

// Trin 2 af login: 2-faktor-kode (TOTP) efter adgangskoden.
export function PartnerVerifyForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/partner/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Forkert kode");
        if (res.status === 401 && data.message?.includes("udløbet")) router.push("/partner/login");
        return;
      }
      router.push("/partner");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <PartnerCodeInput code={code} onChange={setCode} />
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <button type="submit" disabled={loading || code.length !== 6} className="hf-btn-primary w-full py-2.5">
        {loading ? "Bekræfter…" : "Bekræft"}
      </button>
    </form>
  );
}

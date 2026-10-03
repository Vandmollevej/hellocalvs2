"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNewPasswordFields } from "@/components/admin/AdminNewPasswordFields";
import { ADMIN_PASSWORD_REQUIREMENTS_MESSAGE, isAdminPasswordValid } from "@/lib/admin-password-policy";

// Accept af invitation til partnerportalen: vælg adgangskode (samme krav som
// admin-adgangskoder), derefter er brugeren logget ind.
export function PartnerInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setAttempted(true);
    if (!isAdminPasswordValid(password)) {
      setError(ADMIN_PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }
    if (password !== confirm) {
      setError("Adgangskoderne er ikke ens");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/partner/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Kunne ikke gennemføre tilmeldingen");
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
      <AdminNewPasswordFields
        label="Vælg adgangskode"
        password={password}
        confirm={confirm}
        onPasswordChange={setPassword}
        onConfirmChange={setConfirm}
        showErrors={attempted}
      />
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <button type="submit" disabled={loading} className="hf-btn-primary w-full py-2.5 disabled:opacity-60">
        {loading ? "Opretter…" : "Gem adgangskode og log ind"}
      </button>
    </form>
  );
}

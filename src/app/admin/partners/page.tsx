import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";

// Admin "Partnere" (docs/DECISIONS.md 2026-09-27): menupunktet er oprettet
// efter brugerens ønske; indholdet er endnu ikke specificeret.
export default async function PartnersPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-text-primary">Partnere</h1>
      <p className="rounded-lg border border-border-strong bg-surface-2 p-4 text-sm text-text-secondary">
        Ingen partnere endnu. Indholdet af denne side er ikke fastlagt.
      </p>
    </div>
  );
}

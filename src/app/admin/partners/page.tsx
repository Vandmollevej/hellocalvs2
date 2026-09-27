import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";

// Admin "Partnere" (docs/DECISIONS.md 2026-09-27): menupunktet er oprettet
// efter brugerens ønske; indholdet er endnu ikke specificeret.
export default async function PartnersPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">Partnere</h1>
      <p className="hf-type-body rounded-lg border border-hf-tan-dark bg-hf-white p-4 text-text-secondary">
        Ingen partnere endnu. Indholdet af denne side er ikke fastlagt.
      </p>
    </div>
  );
}

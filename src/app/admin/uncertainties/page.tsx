import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { UncertaintiesBoard } from "@/components/admin/UncertaintiesBoard";
import { LegacyWarnings } from "@/components/admin/LegacyWarnings";
import { UNCERTAINTY_FIELDS, UNCERTAINTY_TABS, UNCERTAINTY_TARGET, listUncertainties } from "@/lib/uncertainties";

// Admin "Uncertainties" (docs/DECISIONS.md 2026-09-24): erstatter
// "Advarsler". Fire faner med produkter, hvor AI'en var under målet på
// 90 % sikkerhed; de tidligere advarsler vises nederst.
export default async function AdminUncertaintiesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const rows = await listUncertainties();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Uncertainties</h1>
        <p className="text-sm text-text-secondary">
          Produkter hvor AI&apos;en var mindre end {Math.round(UNCERTAINTY_TARGET * 100)} % sikker på forside,
          næringsindhold, ingrediensliste eller EAN. Ret værdierne i lightboxen — rettelsen skrives til produktet
          og gemmes som træningsdata.
        </p>
      </div>

      <UncertaintiesBoard rows={rows} tabs={UNCERTAINTY_TABS} fields={UNCERTAINTY_FIELDS} target={UNCERTAINTY_TARGET} />

      <div className="flex flex-col gap-8 border-t border-border-strong pt-6">
        <h2 className="text-base font-semibold text-text-primary">Øvrige advarsler</h2>
        <LegacyWarnings />
      </div>
    </div>
  );
}

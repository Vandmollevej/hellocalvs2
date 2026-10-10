import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { UncertaintiesBoard } from "@/components/admin/UncertaintiesBoard";
import { EnergySplitFlags } from "@/components/admin/EnergySplitFlags";
import { FridaMatchReviews } from "@/components/admin/FridaMatchReviews";
import { LegacyWarnings } from "@/components/admin/LegacyWarnings";
import { UNCERTAINTY_FIELDS, UNCERTAINTY_TABS, listUncertainties } from "@/lib/uncertainties";
import { HIDE_FROM_SEARCH_BELOW, UNCERTAINTY_TARGET, URGENT_BELOW } from "@/lib/uncertainty-thresholds";

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
        <h1 className="hf-type-title text-hf-black">Usikkerheder</h1>
        <p className="hf-type-body text-text-secondary">
          Varer hvor AI&apos;en var mindre end {Math.round(UNCERTAINTY_TARGET * 100)} % sikker på forside,
          næringsindhold, ingrediensliste eller EAN, og fotos hvor billedrobotten er usikker på, om de hører til
          varen. Ret værdierne i lightboxen — rettelsen skrives til varen
          og gemmes som træningsdata.
        </p>
      </div>

      <UncertaintiesBoard
        rows={rows}
        tabs={UNCERTAINTY_TABS}
        fields={UNCERTAINTY_FIELDS}
        target={UNCERTAINTY_TARGET}
        urgentBelow={URGENT_BELOW}
        hideBelow={HIDE_FROM_SEARCH_BELOW}
      />

      <div className="border-t border-hf-tan-dark pt-6">
        <EnergySplitFlags />
      </div>

      <div className="border-t border-hf-tan-dark pt-6">
        <FridaMatchReviews />
      </div>

      <div className="flex flex-col gap-8 border-t border-hf-tan-dark pt-6">
        <h2 className="hf-type-body hf-type-strong text-hf-black">Øvrige advarsler</h2>
        <LegacyWarnings />
      </div>
    </div>
  );
}

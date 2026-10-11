import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { UncertaintiesBoard } from "@/components/admin/UncertaintiesBoard";
import { EnergySplitFlags } from "@/components/admin/EnergySplitFlags";
import { FridaMatchReviews } from "@/components/admin/FridaMatchReviews";
import { LegacyWarnings } from "@/components/admin/LegacyWarnings";
import {
  UNCERTAINTY_FIELDS,
  UNCERTAINTY_TABS,
  countUncertaintiesByTab,
  listUncertaintyPage,
} from "@/lib/uncertainties";
import { HIDE_FROM_SEARCH_BELOW, UNCERTAINTY_TARGET, URGENT_BELOW } from "@/lib/uncertainty-thresholds";

// Admin "Uncertainties" (docs/DECISIONS.md 2026-09-24): erstatter
// "Advarsler". Fire faner med produkter, hvor AI'en var under målet på
// 90 % sikkerhed; de tidligere advarsler vises nederst.
//
// Hastighed (docs/DECISIONS.md 2026-10-11): kun første udsnit af første fane
// hentes her; resten hentes gradvist af brættet (evigheds-scroll eller
// sideinddelt). De tunge advarsler nederst streames bagefter i stedet for at
// holde hele siden tilbage.
const PAGE_SIZE = 30;

function SectionFallback({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-busy="true">
      <p className="hf-type-small text-text-muted">{label}</p>
      <div className="hf-surface h-16 animate-pulse" />
    </div>
  );
}

export default async function AdminUncertaintiesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const [counts, first] = await Promise.all([
    countUncertaintiesByTab(),
    listUncertaintyPage(UNCERTAINTY_TABS[0].key, "uncertainty", 0, PAGE_SIZE),
  ]);

  return (
    <div className="hf-admin-page">
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
        initialRows={first.rows}
        initialTotal={first.total}
        initialCounts={counts}
        pageSize={PAGE_SIZE}
        tabs={UNCERTAINTY_TABS}
        fields={UNCERTAINTY_FIELDS}
        target={UNCERTAINTY_TARGET}
        urgentBelow={URGENT_BELOW}
        hideBelow={HIDE_FROM_SEARCH_BELOW}
      />

      <div className="border-t border-hf-tan-dark pt-6">
        <Suspense fallback={<SectionFallback label="Henter energi-afvigelser…" />}>
          <EnergySplitFlags />
        </Suspense>
      </div>

      <div className="border-t border-hf-tan-dark pt-6">
        <Suspense fallback={<SectionFallback label="Henter Frida-forslag…" />}>
          <FridaMatchReviews />
        </Suspense>
      </div>

      <div className="flex flex-col gap-8 border-t border-hf-tan-dark pt-6">
        <h2 className="hf-type-body hf-type-strong text-hf-black">Øvrige advarsler</h2>
        <Suspense fallback={<SectionFallback label="Henter øvrige advarsler…" />}>
          <LegacyWarnings />
        </Suspense>
      </div>
    </div>
  );
}

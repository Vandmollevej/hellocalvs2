import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadOffImagePage, parseOffImageQuery } from "@/lib/off-image-review";
import { OffImageReview } from "@/components/admin/OffImageReview";

// Admin → Varedatabase → Open Food Facts → Billeder (docs/DECISIONS.md
// 2026-10-11): alle billeder hentet fra Open Food Facts, til gennemgang /
// godkendt / afvist. Afviste billeder sendes til scan-appens "Skal scannes"
// (betalt) og holder genscan-banneret ("Optjen 10 points") i live.
export default async function AdminOffImagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const query = parseOffImageQuery(await searchParams);
  const page = await loadOffImagePage(query);
  // Offset kan være rettet ind efter en tom side.
  const effective = { ...query, offset: page.offset };
  const key = [
    effective.tab,
    effective.sort,
    effective.offset,
    effective.perPage,
    effective.minInteractions,
    effective.q,
    page.items.length,
    page.items[0]?.id ?? "",
  ].join("|");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="hf-type-title text-hf-black">Open Food Facts · Billeder</h1>
        <p className="hf-type-body text-text-secondary">
          Billederne på de varer, vi har hentet fra Open Food Facts. Tryk på højre halvdel af et billede for at godkende det,
          venstre halvdel for at afvise det. Afviste billeder sendes til scan-appens liste &quot;Skal scannes&quot;, som
          medarbejderne får penge for at klare, og brugerne får stadig tilbudt points for at scanne forsiden igen.
        </p>
      </div>
      <OffImageReview
        key={key}
        items={page.items}
        total={page.total}
        counts={page.counts}
        query={effective}
        canEdit={admin.adminAccessLevel === "FULL"}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SEARCH_RANKING_WEIGHTS } from "@/lib/product-search-ranking";
import { sanitizeWeights } from "@/lib/search-ranking-config";
import { SearchRankingTuner } from "@/components/admin/SearchRankingTuner";

export default async function AdminSearchRankingPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const configs = await prisma.searchRankingConfig.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { createdBy: { select: { displayName: true, email: true } } },
  });
  const active = configs.find((config) => config.isActive);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="hf-type-title text-hf-black">Søgealgoritmer</h1>
        <p className="hf-type-body text-text-secondary">
          Justér prioriteringen af søgerangeringens parametre og test live, hvordan ændringerne påvirker
          søgeresultatet, før du committer dem. Tekstmatch er altid grundlaget og kan ikke justeres her — det
          er en fast produktbeslutning (docs/DECISIONS.md), så et forkert produkt aldrig kan vinde over et
          korrekt tekstmatch, uanset hvor højt de øvrige parametre skrues op.
        </p>
      </div>
      <SearchRankingTuner
        initialWeights={active ? sanitizeWeights(active.weights) : DEFAULT_SEARCH_RANKING_WEIGHTS}
        defaultWeights={DEFAULT_SEARCH_RANKING_WEIGHTS}
        activeId={active?.id ?? null}
        initialHistory={configs.map((config) => ({
          id: config.id,
          weights: sanitizeWeights(config.weights),
          isActive: config.isActive,
          note: config.note,
          createdAt: config.createdAt.toISOString(),
          createdBy: config.createdBy?.displayName ?? config.createdBy?.email ?? null,
        }))}
      />
    </div>
  );
}

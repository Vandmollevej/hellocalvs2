import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SEARCH_RANKING_WEIGHTS } from "@/lib/product-search-ranking";
import { sanitizeWeights } from "@/lib/search-ranking-config";
import { SearchRankingTuner } from "@/components/admin/SearchRankingTuner";
import { userLabel } from "@/lib/user-label";

// Hvad /api/products søger i, og i hvilken rækkefølge resultatet sorteres
// (docs/DECISIONS.md 2026-10-10). Holdes i takt med src/app/api/products/route.ts
// og src/lib/product-search-ranking.ts.
const SEARCHED_FIELDS = [
  "Titel (ental) og titel i flertal",
  "Brand — også når varesiden kun viser brandets logo",
  "Subbrand (produktserie) — også når det kun vises som logo",
  "Varetype, variant, smag og søgeord — også sammensatte ord (\"instantkaffe\" = \"instant kaffe\")",
  "Synonymer fra Synonymordbogen",
  "Sukkerpåstande (sukkerfri, uden tilsat sukker, reduceret sukker, light, lavt sukker)",
  "Uden hensyn til accenter og store/små bogstaver, og med stavekontrol (\"Mente du …?\")",
];

const RANKING_ORDER = [
  "Brand eller subbrand nævnt i søgningen: brandets varer står altid øverst — også når produkttypen passer bedre på en anden vare. Indbyrdes sorteres de efter resten af søgningen (\"arla skyr\" → Arla skyr før Arla mælk).",
  "Tekstmatch: titel først, derefter brand/subbrand, så varetype, variant og smag.",
  "Parametrene herunder (popularitet, tidspunkt, region m.m.) ordner varer med lige godt tekstmatch.",
];

export default async function AdminSearchRankingPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const configs = await prisma.searchRankingConfig.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { createdBy: { select: { id: true, displayName: true } } },
  });
  const active = configs.find((config) => config.isActive);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="hf-type-title text-hf-black">Søgealgoritmer</h1>
        <p className="hf-type-body text-text-secondary">
          Justér prioriteringen af søgerangeringens parametre og test live, hvordan ændringerne påvirker
          søgeresultatet, før du committer dem. Tekstmatch er grundlaget og kan ikke justeres her — det er en
          fast varebeslutning (docs/DECISIONS.md). Eneste undtagelse: nævner søgningen et brand eller
          subbrand, står dets varer øverst (parametrene &quot;Brand nævnt i søgningen&quot; og &quot;Subbrand
          nævnt i søgningen&quot;).
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-md border border-hf-tan-dark bg-hf-white p-4">
        <h2 className="hf-type-body hf-type-strong text-hf-black">Søgeparametre</h2>
        <p className="hf-type-small text-text-secondary">Søgningen finder varer på:</p>
        <ul className="hf-type-small flex list-disc flex-col gap-1 pl-5 text-text-secondary">
          {SEARCHED_FIELDS.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
        <p className="hf-type-small text-text-secondary">Rækkefølgen i resultatet:</p>
        <ol className="hf-type-small flex list-decimal flex-col gap-1 pl-5 text-text-secondary">
          {RANKING_ORDER.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
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
          createdBy: config.createdBy ? userLabel(config.createdBy) : null,
        }))}
      />
    </div>
  );
}

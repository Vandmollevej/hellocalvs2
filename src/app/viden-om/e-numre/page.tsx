"use client";

import { useEffect, useState } from "react";
import { IconFlask } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { KnowledgeRows } from "@/components/knowledge/KnowledgeRows";
import { SearchField } from "@/components/knowledge/SearchField";
import { listAdditives, matchesAdditive, type AdditiveInfo } from "@/lib/additives";

// E-numre som blok-liste; hver række åbner den eksisterende detaljeside
// /e-numre/<kode> (E-nummer-data og -sider er uændrede).
export default function KnowledgeENumbersPage() {
  const [query, setQuery] = useState("");
  const [additives, setAdditives] = useState<AdditiveInfo[] | null>(null);

  useEffect(() => {
    listAdditives()
      .then(setAdditives)
      .catch(() => setAdditives([]));
  }, []);

  const rows = (additives ?? [])
    .filter((item) => matchesAdditive(item, query))
    .map((item) => ({
      key: item.eNumber,
      label: `${item.eNumber.toUpperCase()}${item.danishName || item.internationalName ? ` · ${item.danishName || item.internationalName}` : ""}`,
      href: `/e-numre/${encodeURIComponent(item.eNumber.toUpperCase())}`,
    }));

  return (
    <HfScreen title="E-numre" icon={<IconFlask size={20} stroke={2} />} alwaysShowBackButton>
      <div className="hf-page flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="Søg på E-nummer eller navn" />
        {additives === null ? (
          <p className="hf-type-body text-center text-text-secondary">Henter...</p>
        ) : (
          <KnowledgeRows rows={rows} icon={<IconFlask size={20} />} />
        )}
      </div>
    </HfScreen>
  );
}

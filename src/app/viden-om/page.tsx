"use client";

import { useEffect, useState } from "react";
import { IconBook } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { KnowledgeRows } from "@/components/knowledge/KnowledgeRows";
import { SearchField } from "@/components/knowledge/SearchField";
import { KNOWLEDGE_SECTIONS, entryHref, searchEntries } from "@/lib/knowledge-index";
import { listAdditives, matchesAdditive, type AdditiveInfo } from "@/lib/additives";
import { KITCHEN_CONVERSIONS } from "@/lib/kitchen-conversions";

// "Viden om mad" (åbnes fra profilsiden): blokke for vitaminer, E-numre,
// sundhedstips, kalorieforbrænding, WHO, Mad på latin og Omregning. Søgningen på
// forsiden dækker alt, også de enkelte E-numre; undersiderne søger kun i
// deres eget afsnit.
export default function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [additives, setAdditives] = useState<AdditiveInfo[]>([]);
  useEffect(() => {
    listAdditives()
      .then(setAdditives)
      .catch(() => setAdditives([]));
  }, []);
  const q = query.trim();
  const rows = q
    ? [
        ...searchEntries(q).map((entry) => ({
          key: `${entry.section}/${entry.slug}`,
          label: entry.title,
          href: entryHref(entry.section, entry.slug),
        })),
        ...(q.length >= 2 && "e-numre".startsWith(q.toLowerCase())
          ? [{ key: "e-numre", label: "E-numre", href: "/viden-om/e-numre" }]
          : []),
        ...(q.length >= 2 && "omregning".startsWith(q.toLowerCase())
          ? [{ key: "omregning", label: "Omregning: væsker til gram", href: "/viden-om/omregning" }]
          : []),
        ...(q.length >= 2
          ? KITCHEN_CONVERSIONS.filter((item) => item.name.toLowerCase().includes(q.toLowerCase()))
              .slice(0, 10)
              .map((item) => ({
                key: `omregning/${item.id}`,
                label: `${item.name} · 1 dl = ${item.gramsPerDl} g`,
                href: "/viden-om/omregning",
              }))
          : []),
        ...additives
          .filter((item) => matchesAdditive(item, q))
          .slice(0, 30)
          .map((item) => ({
            key: `e-${item.eNumber}`,
            label: `${item.eNumber.toUpperCase()}${item.danishName || item.internationalName ? ` · ${item.danishName || item.internationalName}` : ""}`,
            href: `/e-numre/${encodeURIComponent(item.eNumber.toUpperCase())}`,
          })),
      ]
    : KNOWLEDGE_SECTIONS.map((section) => ({ key: section.id, label: section.title, href: `/viden-om/${section.id}` }));

  return (
    <HfScreen title="Viden om mad" icon={<IconBook size={20} stroke={2} />} alwaysShowBackButton>
      <div className="hf-page flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="Søg i alt: vitaminer, E-numre, forbrænding, WHO og ord" />
        <KnowledgeRows rows={rows} icon={<IconBook size={20} />} />
      </div>
    </HfScreen>
  );
}

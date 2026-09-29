"use client";

import { useState } from "react";
import { IconBulb } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { KnowledgeRows } from "@/components/knowledge/KnowledgeRows";
import { SearchField } from "@/components/knowledge/SearchField";
import { KNOWLEDGE_SECTIONS, entryHref, searchEntries } from "@/lib/knowledge-index";

// "Viden om" (åbnes fra profilsiden): blokke for vitaminer, E-numre,
// sundhedstips og Mad på latin. Søgning dækker alle artikler og ord.
export default function KnowledgePage() {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const rows = q
    ? [
        ...searchEntries(q).map((entry) => ({
          key: `${entry.section}/${entry.slug}`,
          label: entry.title,
          href: entryHref(entry.section, entry.slug),
        })),
        ...(/^e\s?-?\d/i.test(q) || "e-numre".startsWith(q.toLowerCase())
          ? [{ key: "e-numre", label: "E-numre", href: "/viden-om/e-numre" }]
          : []),
      ]
    : KNOWLEDGE_SECTIONS.map((section) => ({ key: section.id, label: section.title, href: `/viden-om/${section.id}` }));

  return (
    <HfScreen title="Viden om" icon={<IconBulb size={20} stroke={2} />} alwaysShowBackButton>
      <div className="hf-page flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="Søg i vitaminer, sundhedstips og ord" />
        <KnowledgeRows rows={rows} icon={<IconBulb size={20} />} />
      </div>
    </HfScreen>
  );
}

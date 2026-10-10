"use client";

import { useState } from "react";
import { notFound, useParams } from "next/navigation";
import { IconBook } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { KnowledgeRows } from "@/components/knowledge/KnowledgeRows";
import { SearchField } from "@/components/knowledge/SearchField";
import { entryHref, searchEntries, sectionTitle, type KnowledgeSection } from "@/lib/knowledge-index";

export default function KnowledgeSectionPage() {
  const { category } = useParams<{ category: string }>();
  const [query, setQuery] = useState("");
  const title = sectionTitle(category);
  if (!title || category === "e-numre" || category === "omregning") notFound();
  const rows = searchEntries(query, category as KnowledgeSection).map((entry) => ({
    key: entry.slug,
    label: entry.title,
    href: entryHref(entry.section, entry.slug),
  }));
  return (
    <HfScreen title={title} icon={<IconBook size={20} stroke={2} />} alwaysShowBackButton>
      <div className="hf-page flex flex-col gap-3">
        <SearchField value={query} onChange={setQuery} placeholder={`Søg i ${title.toLowerCase()}`} />
        <KnowledgeRows rows={rows} icon={<IconBook size={20} />} />
      </div>
    </HfScreen>
  );
}

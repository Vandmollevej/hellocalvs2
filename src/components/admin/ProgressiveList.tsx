"use client";

import { useState } from "react";
import { ListPager, LoadMoreSentinel, useListMode } from "@/components/admin/ListMode";

// Viser en lang liste af færdigtegnede elementer gradvist (docs/DECISIONS.md
// 2026-10-11): efter brugerens valg som evigheds-scroll (næste bidrag
// afsløres, mens man scroller) eller sideinddelt. Elementerne kommer fra
// serveren; her holdes bare siden let at tegne og bladre i.
export function ProgressiveList({
  items,
  pageSize = 20,
  className = "flex flex-col gap-4",
}: {
  items: React.ReactNode[];
  pageSize?: number;
  className?: string;
}) {
  const [mode] = useListMode();
  const [shown, setShown] = useState(pageSize);
  const [page, setPage] = useState(1);

  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  const visible =
    mode === "scroll" ? items.slice(0, shown) : items.slice((current - 1) * pageSize, current * pageSize);

  return (
    <>
      <div className={className}>{visible}</div>
      {mode === "scroll" && shown < items.length && (
        <LoadMoreSentinel onVisible={() => setShown((n) => n + pageSize)} loading={false} />
      )}
      {mode === "pages" && <ListPager page={current} pages={pages} onPage={setPage} />}
    </>
  );
}

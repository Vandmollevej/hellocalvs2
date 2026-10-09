"use client";

import { useState } from "react";
import type { ImageGroup } from "@/lib/duplicate-review";
import { DuplicateImageGroup } from "@/components/admin/DuplicateImageGroup";
import { ReviewSizePicker, useReviewSize } from "@/components/admin/ReviewSizePicker";

// Billed-dubletter med samme visningsvælger som Logoer og Billedforslag:
// 1/2/4 varer ad gangen af de varer, serveren har hentet til siden.
export function DuplicateImageList({ groups }: { groups: ImageGroup[] }) {
  const { sizeIdx, perPage, choose } = useReviewSize("hc-admin-duplicate-images-size");
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(groups.length / perPage));
  const safePage = Math.min(page, pageCount - 1);
  const visible = groups.slice(safePage * perPage, safePage * perPage + perPage);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="hf-type-small text-text-secondary">
          {groups.length} varer · viser {safePage * perPage + 1}–{safePage * perPage + visible.length}
        </p>
        <ReviewSizePicker sizeIdx={sizeIdx} onChoose={choose} />
      </div>
      <div className={`grid gap-4 ${perPage === 4 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {visible.map((group) => (
          <DuplicateImageGroup key={group.productId} group={group} />
        ))}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className="hf-btn-text">
            ‹ Forrige
          </button>
          <span className="hf-type-small text-text-secondary">
            {safePage + 1} / {pageCount}
          </span>
          <button type="button" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1} className="hf-btn-text">
            Næste ›
          </button>
        </div>
      )}
    </div>
  );
}

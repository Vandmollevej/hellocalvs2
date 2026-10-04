"use client";

import { useRouter } from "next/navigation";
import { ImageReviewBoard, type ReviewItem } from "@/components/admin/ImageReviewBoard";

// Billedforslag (Google) til godkendelse: nuværende billede og forslag side om
// side, i valgfri størrelse med lightbox (docs/DECISIONS.md 2026-10-04).
export function PendingImageBoard({ items }: { items: ReviewItem[] }) {
  const router = useRouter();

  async function call(id: string, action: "accept" | "reject") {
    const res = await fetch(`/api/admin/products/${id}/image/${action}`, { method: "POST" });
    if (res.ok) router.refresh();
    return res.ok;
  }

  return (
    <ImageReviewBoard
      items={items}
      approveLabel="Godkend forslag"
      rejectLabel="Afvis"
      onApprove={(id) => call(id, "accept")}
      onReject={(id) => call(id, "reject")}
      emptyText="Ingen billedforslag afventer godkendelse."
      storageKey="hc-admin-image-board-size"
    />
  );
}

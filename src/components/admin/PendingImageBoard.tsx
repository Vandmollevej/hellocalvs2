"use client";

import { useRouter } from "next/navigation";
import { ImageReviewBoard, type ReviewItem } from "@/components/admin/ImageReviewBoard";

// Billedforslag til godkendelse: nuværende billede og forslag side om side, i
// valgfri størrelse med lightbox (docs/DECISIONS.md 2026-10-04). Har Google
// fundet originalen online, vælges mellem udklippet og fundene (2026-10-15).
export function PendingImageBoard({ items }: { items: ReviewItem[] }) {
  const router = useRouter();

  async function call(id: string, action: "accept" | "reject") {
    const res = await fetch(`/api/admin/products/${id}/image/${action}`, { method: "POST" });
    if (res.ok) router.refresh();
    return res.ok;
  }

  // Et originalbillede fundet online (docs/DECISIONS.md 2026-10-15); "pending"
  // er udklippet af kamerafotoet.
  async function approve(id: string, alternativeKey?: string) {
    const item = items.find((entry) => entry.id === id);
    const key = alternativeKey ?? item?.alternatives?.[0]?.key;
    if (!key || key === "pending") return call(id, "accept");
    const res = await fetch(`/api/admin/products/${id}/image/web`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: key }),
    });
    if (res.ok) router.refresh();
    return res.ok;
  }

  return (
    <ImageReviewBoard
      items={items}
      approveLabel="Godkend forslag"
      rejectLabel="Afvis"
      onApprove={approve}
      onReject={(id) => call(id, "reject")}
      emptyText="Ingen billedforslag afventer godkendelse."
      storageKey="hc-admin-image-board-size"
      bulkProducts
    />
  );
}

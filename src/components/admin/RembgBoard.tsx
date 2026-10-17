"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ImageWorkbench, type WorkbenchAction, type WorkbenchItem } from "@/components/admin/ImageWorkbench";

// Fritlagte billeder: rembg-fil ↔ varens nuværende billede (docs/DECISIONS.md 2026-10-17).
export function RembgBoard({ items, readOnly, emptyText, tab }: { items: WorkbenchItem[]; readOnly: boolean; emptyText: string; tab: string }) {
  const router = useRouter();
  const onDecide = useCallback(
    async (ids: string[], action: WorkbenchAction) => {
      const res = await fetch("/api/admin/image-review/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { done: string[] };
      router.refresh();
      return data.done;
    },
    [router],
  );
  return <ImageWorkbench items={items} onDecide={onDecide} readOnly={readOnly} emptyText={emptyText} storageKey={`hc-admin-rembg-${tab === "rejected" ? "pending" : tab}`} />;
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageWorkbench, type WorkbenchAction, type WorkbenchItem } from "@/components/admin/ImageWorkbench";
import type { ReviewItem } from "@/components/admin/ImageReviewBoard";

// Billedforslag til godkendelse: nuværende billede og forslag side om side
// (docs/DECISIONS.md 2026-10-04). Har Google fundet originalen online, vælges
// mellem udklippet og fundene (2026-10-15). Samme arbejdsflade som Fritlagte
// billeder (2026-10-17): grid, baggrund, Vælg, hover-knapper og log.
const TOOLS = [
  { key: "too-bright", label: "For lyst" },
  { key: "too-dark", label: "For mørkt" },
  { key: "edge-in", label: "Kant ind (1 px)" },
];

export function PendingImageBoard({ items }: { items: ReviewItem[] }) {
  const router = useRouter();
  // Nyt forslag efter OpenAI-forsøg eller værktøj (erstatter serverens, indtil siden hentes igen).
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const workbenchItems = useMemo<WorkbenchItem[]>(
    () =>
      items.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        left: { src: item.slides[0]?.src ?? null, label: item.slides[0]?.label ?? "Nuværende" },
        right: overrides[item.id] ? { src: overrides[item.id], label: "Forslag" } : (item.slides[1] ?? { src: null, label: "Intet forslag" }),
        alternatives: item.alternatives?.length
          ? item.alternatives.map((alt, index) => {
              const key = alt.key ?? String(index);
              return { key, src: key === "pending" && overrides[item.id] ? overrides[item.id] : alt.src, label: alt.label };
            })
          : undefined,
      })),
    [items, overrides],
  );

  const post = useCallback(async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  }, []);

  const postJson = useCallback(async <T,>(url: string, body: unknown): Promise<T | null> => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok ? ((await res.json().catch(() => null)) as T | null) : null;
  }, []);

  const onTool = useCallback(
    async (id: string, tool: string) => {
      const data = await postJson<{ pendingImageUrl?: string }>(`/api/admin/products/${id}/image/adjust`, { action: tool });
      if (!data?.pendingImageUrl) return false;
      setOverrides((state) => ({ ...state, [id]: data.pendingImageUrl as string }));
      return true;
    },
    [postJson],
  );

  const approve = useCallback(
    async (id: string, key?: string) => {
      // Et originalbillede fundet online (docs/DECISIONS.md 2026-10-15); "pending"
      // er udklippet af kamerafotoet, "pending-bria" Bria-udgaven (docs/BRIA.md).
      if (!key || key === "pending") return post(`/api/admin/products/${id}/image/accept`, {});
      if (key === "pending-bria") return post(`/api/admin/products/${id}/image/accept`, { variant: "bria" });
      return post(`/api/admin/products/${id}/image/web`, { candidateId: key });
    },
    [post],
  );

  const onDecide = useCallback(
    async (ids: string[], action: WorkbenchAction, keys: Record<string, string>) => {
      const done: string[] = [];
      for (const id of ids) {
        // Afvis af ét forslag: OpenAI får ét nyt forsøg (docs/DECISIONS.md 2026-10-17); lykkes det, står varen
        // stadig på listen med det nye forslag.
        if (action === "REJECT" && ids.length === 1) {
          const data = await postJson<{ retried?: boolean; pendingImageUrl?: string }>(`/api/admin/products/${id}/image/reject`, {
            mode: "both",
            retryOpenAi: true,
          });
          if (data?.retried && data.pendingImageUrl) {
            setOverrides((state) => ({ ...state, [id]: data.pendingImageUrl as string }));
            continue;
          }
          if (data) done.push(id);
          continue;
        }
        const ok =
          action === "ACCEPT"
            ? await approve(id, keys[id])
            : await post(`/api/admin/products/${id}/image/reject`, { mode: action === "KEEP" ? "keep" : "both" });
        if (ok) done.push(id);
      }
      if (done.length > 0) {
        await post("/api/admin/image-review/suggestions/decide", {
          action: action === "ACCEPT" ? "ACCEPT" : "REJECT",
          items: done.map((id) => ({ id, title: items.find((item) => item.id === id)?.title ?? "" })),
        });
        router.refresh();
      }
      return done;
    },
    [approve, items, post, postJson, router],
  );

  return (
    <ImageWorkbench
      items={workbenchItems}
      onDecide={onDecide}
      acceptLabel="Accepter"
      rejectLabel="Afvis"
      keepLabel="Behold nuværende"
      emptyText="Ingen billedforslag afventer godkendelse."
      storageKey="hc-admin-image-board"
      tools={TOOLS}
      onTool={onTool}
    />
  );
}

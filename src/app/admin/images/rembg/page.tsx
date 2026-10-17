import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ImagesTabs } from "@/components/admin/ImagesTabs";
import { RembgUploader } from "@/components/admin/RembgUploader";
import { RembgBoard } from "@/components/admin/RembgBoard";
import { ImageReviewLog, type ReviewLogEntry } from "@/components/admin/ImageReviewLog";
import type { WorkbenchItem } from "@/components/admin/ImageWorkbench";
import { REVIEW_TABS } from "@/lib/image-review";

// Billedbehandling → Fritlagte billeder (docs/DECISIONS.md 2026-10-17): rembg-
// filer uploades og sammenlignes med varens nuværende billede. Faner:
// Afventer, Eksisterende (varen har allerede et fritlagt billede), Afvist,
// Accepteret, Ikke matchet og Log.
const EMPTY_TEXT: Record<string, string> = {
  pending: "Ingen fritlagte billeder afventer. Upload rembg-filer ovenfor.",
  existing: "Ingen af de uploadede billeder hører til en vare, der allerede har et fritlagt billede.",
  rejected: "Ingen afviste billeder.",
  accepted: "Ingen accepterede billeder endnu.",
  unmatched: "Alle uploadede filer er matchet med en vare.",
};

export default async function AdminRembgReviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "log" || REVIEW_TABS.some((t) => t.key === rawTab) ? (rawTab as string) : "pending";

  const grouped = await prisma.imageReview.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = new Map(grouped.map((row) => [row.status, row._count._all]));

  let items: WorkbenchItem[] = [];
  let logEntries: ReviewLogEntry[] = [];
  const activeTab = REVIEW_TABS.find((t) => t.key === tab);

  if (activeTab) {
    const rows = await prisma.imageReview.findMany({
      where: { status: activeTab.status },
      orderBy: { createdAt: "asc" },
      take: 1000,
    });
    const products = await prisma.product.findMany({
      where: { id: { in: rows.map((row) => row.productId).filter((id): id is string => Boolean(id)) } },
      select: { id: true, name: true, brand: { select: { name: true } }, imageUrl: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    const existing = activeTab.key === "existing";
    items = rows.map((row) => {
      const product = row.productId ? byId.get(row.productId) : undefined;
      return {
        id: row.id,
        title: product?.name ?? row.fileName,
        subtitle: [product?.brand?.name, row.barcode].filter(Boolean).join(" · ") || null,
        left: {
          src: row.status === "ACCEPTED" || row.status === "UNMATCHED" ? row.originalUrl : (product?.imageUrl ?? row.originalUrl),
          label: existing ? "Nuværende (fritlagt)" : row.status === "ACCEPTED" ? "Erstattet billede" : "Original",
        },
        right: { src: row.processedUrl, label: existing ? "Ny fil" : "Rembg" },
      };
    });
  } else {
    const logs = await prisma.imageReviewLog.findMany({ where: { scope: "REMBG" }, orderBy: { createdAt: "desc" }, take: 100 });
    const adminIds = [...new Set(logs.map((log) => log.createdById).filter((id): id is string => Boolean(id)))];
    const admins = await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } });
    const emails = new Map(admins.map((user) => [user.id, user.email]));
    logEntries = logs.map((log) => ({
      id: log.id,
      action: log.action,
      itemCount: log.itemCount,
      createdAt: log.createdAt.toISOString(),
      undone: Boolean(log.undoneAt),
      undoable: true,
      by: log.createdById ? (emails.get(log.createdById) ?? null) : null,
      items: (log.items as unknown as { id: string; title: string; imageUrl: string | null }[]).map((item) => ({
        id: item.id,
        title: item.title,
        imageUrl: item.imageUrl,
      })),
    }));
  }

  const tabs = [
    ...REVIEW_TABS.map((t) => ({ key: t.key as string, label: t.label, count: counts.get(t.status) ?? 0 })),
    { key: "log", label: "Log", count: null as number | null },
  ];

  return (
    <div className="hf-admin-page">
      <h1 className="hf-type-title text-hf-black">Billedbehandling</h1>
      <ImagesTabs active="rembg" />
      <RembgUploader />

      <div className="hf-type-body flex flex-wrap gap-4 border-b border-hf-tan-dark">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/images/rembg?tab=${t.key}`}
            className={`-mb-px border-b-2 pb-2 ${
              tab === t.key ? "hf-type-strong border-hf-green-dark text-hf-green-dark" : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
            {t.count !== null ? ` (${t.count})` : ""}
          </Link>
        ))}
      </div>

      {activeTab ? (
        <RembgBoard
          key={tab}
          tab={tab}
          items={items}
          readOnly={activeTab.status === "ACCEPTED" || activeTab.status === "UNMATCHED"}
          emptyText={EMPTY_TEXT[tab]}
        />
      ) : (
        <ImageReviewLog entries={logEntries} />
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { PendingImageBoard } from "@/components/admin/PendingImageBoard";
import { ImagesTabs } from "@/components/admin/ImagesTabs";
import { briaVariantUrl } from "@/lib/bria-variant";

const pct = (value: number) => `${Math.round(value * 100)} %`;

function host(url: string | null) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

// Billedforslag: varens nuværende billede (for scannede varer kamerafotoet)
// ved siden af udklippet og de originale billeder, Google fandt online
// (logo-agent product_images.py, docs/DECISIONS.md 2026-10-15).
export default async function AdminImagesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      OR: [{ imageStatus: "PENDING" }, { imageSearches: { some: { status: "PENDING_REVIEW" } } }],
    },
    include: {
      brand: true,
      imageSearches: {
        where: { status: "PENDING_REVIEW" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { candidates: { orderBy: { confidence: "desc" }, take: 8 } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="hf-admin-page">
      <h1 className="hf-type-title text-hf-black">Billedbehandling</h1>
      <ImagesTabs active="suggestions" />
      <PendingImageBoard
        items={products.map((product) => {
          const candidates = product.imageSearches[0]?.candidates ?? [];
          const briaUrl = briaVariantUrl(product.pendingImageUrl);
          const alternatives = [
            ...(product.pendingImageUrl ? [{ key: "pending", src: product.pendingImageUrl, label: "Forslag (udklip)" }] : []),
            ...(briaUrl ? [{ key: "pending-bria", src: briaUrl, label: "Forslag (Bria)" }] : []),
            ...candidates.map((candidate) => ({
              key: candidate.id,
              src: candidate.imageUrl,
              label: `Fundet online · ${pct(candidate.confidence)} · ${candidate.width}×${candidate.height}${host(candidate.pageUrl ?? candidate.sourceUrl) ? ` · ${host(candidate.pageUrl ?? candidate.sourceUrl)}` : ""}`,
            })),
          ];
          return {
            id: product.id,
            title: product.name,
            subtitle: product.brand?.name ?? null,
            slides: candidates.length || briaUrl
              ? [{ src: product.imageUrl, label: candidates.length ? "Nuværende (kamerafoto)" : "Nuværende" }]
              : [
                  { src: product.imageUrl, label: "Nuværende" },
                  { src: product.pendingImageUrl, label: "Forslag" },
                ],
            alternatives: candidates.length || briaUrl ? alternatives : undefined,
          };
        })}
      />
    </div>
  );
}

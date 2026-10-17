import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { PendingImageBoard } from "@/components/admin/PendingImageBoard";
import { FindNewImageBoard } from "@/components/admin/FindNewImageBoard";
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
      imageNeedsNew: false,
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

  const needNew = await prisma.product.findMany({
    where: { deletedAt: null, imageNeedsNew: true },
    include: { brand: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="hf-admin-page">
      <h1 className="hf-type-title text-hf-black">Billedbehandling</h1>
      <ImagesTabs active="suggestions" />
      <FindNewImageBoard
        items={needNew.map((product) => ({
          id: product.id,
          title: product.name,
          subtitle: product.brand?.name ?? null,
          imageUrl: product.imageUrl,
          pendingImageUrl: product.pendingImageUrl,
        }))}
      />
      <PendingImageBoard
        items={products.map((product) => {
          const candidates = product.imageSearches[0]?.candidates ?? [];
          const briaUrl = briaVariantUrl(product.pendingImageUrl);
          // Kvalitet 0-100: fundne billeder = match (70 %) + opløsning (30 %); udklip og Bria
          // kan ikke måles og får et fast skøn. Sorteret så det bedste står først.
          const scored = [
            ...(product.pendingImageUrl ? [{ key: "pending", src: product.pendingImageUrl, name: "Forslag (fritlagt udklip)", quality: 90 }] : []),
            ...(briaUrl ? [{ key: "pending-bria", src: briaUrl, name: "Forslag (fritlagt, Bria)", quality: 95 }] : []),
            ...candidates.map((candidate) => ({
              key: candidate.id,
              src: candidate.imageUrl,
              name: `Fundet online · ${pct(candidate.confidence ?? 0)} · ${candidate.width}×${candidate.height}${host(candidate.pageUrl ?? candidate.sourceUrl) ? ` · ${host(candidate.pageUrl ?? candidate.sourceUrl)}` : ""}`,
              quality: Math.round(100 * (0.7 * (candidate.confidence ?? 0) + 0.3 * Math.min(((candidate.width ?? 0) * (candidate.height ?? 0)) / 640000, 1))),
            })),
          ].sort((x, y) => y.quality - x.quality);
          const alternatives = scored.map((alt, i) => ({
            key: alt.key,
            src: alt.src,
            label: `${i === 0 ? "Bedste · " : ""}Kvalitet ${alt.quality} % · ${alt.name}`,
          }));
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

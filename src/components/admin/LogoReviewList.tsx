"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ImageReviewBoard } from "@/components/admin/ImageReviewBoard";
import { chooseLogo, rejectAllLogos } from "@/app/admin/logos/actions";

type Candidate = {
  id: string;
  imageUrl: string;
  confidence: number;
  pageUrl: string;
  brandInPage: boolean;
  aiGenerated: boolean;
  width: number;
  height: number;
};

type Search = { id: string; brandName: string; originalUrl: string; candidates: Candidate[] };

const pct = (value: number) => `${Math.round(value * 100)} %`;

// Logoer til gennemsyn: originaludklippet fra varefotoet ved siden af det
// valgte fund (hentet online eller AI-rentegnet, docs/DECISIONS.md 2026-10-15), med pile midt på billedet og en række af 6 alternativer under. "Vælg"
// gemmer det viste fund; "Ingen passer" lukker sagen.
export function LogoReviewList({ searches }: { searches: Search[] }) {
  const router = useRouter();

  const items = useMemo(
    () =>
      searches.map((search) => ({
        id: search.id,
        title: search.brandName,
        subtitle: search.candidates[0]
          ? search.candidates[0].aiGenerated
            ? "Intet fritlagt logo online — AI-rentegnet"
            : `Bedste fund: ${pct(search.candidates[0].confidence)}`
          : "Ingen fund",
        slides: [{ src: search.originalUrl, label: "Originaludklip fra varefoto" }],
        alternatives: search.candidates.map((candidate, index) => ({
          key: candidate.id,
          src: candidate.imageUrl,
          label: candidate.aiGenerated
            ? `AI-rentegnet · ${candidate.width}×${candidate.height}`
            : `${index === 0 ? "Bedste fund" : `Alternativ ${index + 1}`} · ${pct(candidate.confidence)} · ${candidate.width}×${candidate.height}`,
        })),
      })),
    [searches],
  );

  async function approve(id: string, candidateId?: string) {
    const chosen = candidateId ?? searches.find((search) => search.id === id)?.candidates[0]?.id;
    if (!chosen) return false;
    const form = new FormData();
    form.set("candidateId", chosen);
    const result = await chooseLogo(form);
    if (result.ok) router.refresh();
    return result.ok;
  }

  async function reject(id: string) {
    const form = new FormData();
    form.set("searchId", id);
    const result = await rejectAllLogos(form);
    if (result.ok) router.refresh();
    return result.ok;
  }

  return (
    <ImageReviewBoard
      items={items}
      approveLabel="Vælg"
      rejectLabel="Ingen passer"
      onApprove={approve}
      onReject={reject}
      emptyText="Ingen logoer venter på gennemsyn."
      storageKey="hc-admin-logo-board-size"
    />
  );
}

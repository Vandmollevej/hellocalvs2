"use client";

import { useState } from "react";
import { chooseLogo, rejectAllLogos } from "@/app/admin/logos/actions";

type Candidate = {
  id: string;
  imageUrl: string;
  confidence: number;
  pageUrl: string;
  brandInPage: boolean;
  width: number;
  height: number;
};

type Search = { id: string; brandName: string; originalUrl: string; candidates: Candidate[] };

const pct = (value: number) => `${Math.round(value * 100)} %`;

function Thumb({ src, alt, size = "h-14 w-14" }: { src: string; alt: string; size?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`${size} rounded border border-border-strong bg-white object-contain p-1`} />
  );
}

// Rækker: brandnavn → original-thumbnail → bedste fund. Klik åbner stor
// sammenligning (original og fund side om side) med 5-10 alternativer
// nedenunder; klik på et alternativ forstørrer det (lightbox), og "VÆLG"
// under hvert billede vælger det.
export function LogoReviewList({ searches }: { searches: Search[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const open = searches.find((search) => search.id === openId) ?? null;

  if (!searches.length) return <p className="text-sm text-text-secondary">Ingen logoer venter på gennemsyn.</p>;

  return (
    <>
      <ul className="flex flex-col divide-y divide-border-strong/50 rounded-lg border border-border-strong bg-surface-2">
        {searches.map((search) => {
          const best = search.candidates[0];
          return (
            <li key={search.id}>
              <button type="button" onClick={() => setOpenId(search.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left">
                <span className="flex-1 font-medium">{search.brandName}</span>
                <Thumb src={search.originalUrl} alt={`Original ${search.brandName}`} />
                {best && <Thumb src={best.imageUrl} alt={`Fundet ${search.brandName}`} />}
                <span className="w-14 text-right text-sm">{best ? pct(best.confidence) : "—"}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpenId(null)}>
          <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg bg-page-bg p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">{open.brandName}</h2>
              <button type="button" onClick={() => setOpenId(null)} className="text-sm underline">
                Luk
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <figure className="flex flex-col items-center gap-2">
                <Thumb src={open.originalUrl} alt="Original" size="h-48 w-full" />
                <figcaption className="text-xs text-text-secondary">Original fra produktfoto</figcaption>
              </figure>
              {open.candidates[0] && (
                <figure className="flex flex-col items-center gap-2">
                  <Thumb src={open.candidates[0].imageUrl} alt="Bedste fund" size="h-48 w-full" />
                  <figcaption className="text-xs text-text-secondary">Bedste fund · {pct(open.candidates[0].confidence)}</figcaption>
                </figure>
              )}
            </div>

            <h3 className="mb-2 mt-6 text-sm font-semibold">Alternativer (mindst 50 %)</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {open.candidates.map((candidate) => (
                <div key={candidate.id} className="flex flex-col items-center gap-1">
                  <button type="button" onClick={() => setLightbox(candidate.imageUrl)} aria-label="Forstør">
                    <Thumb src={candidate.imageUrl} alt="Kandidat" size="h-24 w-24" />
                  </button>
                  <span className="text-xs">
                    {pct(candidate.confidence)} · {candidate.width}×{candidate.height}
                  </span>
                  <a href={candidate.pageUrl} target="_blank" rel="noreferrer" className="max-w-full truncate text-[10px] underline">
                    {candidate.brandInPage ? "✓ brand på siden" : "kilde"}
                  </a>
                  <form action={chooseLogo}>
                    <input type="hidden" name="candidateId" value={candidate.id} />
                    <button className="rounded bg-hf-green-dark px-3 py-1 text-xs font-semibold text-white">VÆLG</button>
                  </form>
                </div>
              ))}
            </div>
            <form action={rejectAllLogos} className="mt-6">
              <input type="hidden" name="searchId" value={open.id} />
              <button className="text-sm underline">Ingen af dem passer</button>
            </form>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Forstørret kandidat" className="max-h-full max-w-full rounded bg-white object-contain p-4" />
        </div>
      )}
    </>
  );
}

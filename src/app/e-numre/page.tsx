"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { SkeletonScreen } from "@/components/hf/Skeleton";
import { additiveAnchorId, getAllAdditives, type AdditiveInfo } from "@/lib/additives";

// E-nummer-oversigt (opgave 35). Hvert E-nummer har et anchor (#e330), så
// links fra produktsiden lander direkte på det pågældende stof. Listen hentes
// klientside, så browserens egen hash-scroll sker før indholdet findes —
// derfor scroller vi selv, når listen er renderet.
export default function AdditivesPage() {
  const [additives, setAdditives] = useState<AdditiveInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllAdditives()
      .then((rows) => {
        if (!cancelled) setAdditives(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!additives) return;
    const scrollToHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1)).toLowerCase();
      if (!id) return;
      const element = document.getElementById(id);
      if (!element) return;
      element.scrollIntoView({ block: "start" });
      setTargetId(id);
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [additives]);

  return (
    <HfScreen title="E-numre">
      {failed ? (
        <p className="hf-type-body text-text-secondary">Kunne ikke hente E-nummer-databasen.</p>
      ) : !additives ? (
        <SkeletonScreen>{null}</SkeletonScreen>
      ) : (
        <div className="flex flex-col gap-3">
          {additives.map((info) => {
            const id = additiveAnchorId(info.eNumber);
            return (
              <section
                key={id}
                id={id}
                className={`scroll-mt-4 rounded-2xl p-4 transition-colors ${
                  targetId === id ? "bg-hf-green/15 ring-2 ring-hf-green" : "bg-hf-tan"
                }`}
              >
                <p className="hf-type-body hf-heading text-hf-black">
                  {info.eNumber.toUpperCase()}
                  {info.internationalName ? ` · ${info.internationalName}` : ""}
                </p>
                {info.danishName && (
                  <p className="hf-type-small text-text-secondary">{info.danishName}</p>
                )}
                {info.function && (
                  <p className="hf-type-body mt-2 text-hf-black">{info.function}</p>
                )}
                {info.risks && (
                  <div className="mt-3">
                    <p className="hf-type-small text-text-secondary hf-heading uppercase">Risici</p>
                    <p className="hf-type-body text-hf-black">{info.risks}</p>
                  </div>
                )}
                {info.research && (
                  <div className="mt-3">
                    <p className="hf-type-small text-text-secondary hf-heading uppercase">Forskning</p>
                    <p className="hf-type-body text-hf-black">{info.research}</p>
                  </div>
                )}
                {info.link && (
                  <a
                    href={info.link}
                    target="_blank"
                    rel="noreferrer"
                    className="hf-type-small mt-3 inline-block text-hf-green underline underline-offset-2"
                  >
                    Læs mere ({info.source || "kilde"})
                  </a>
                )}
              </section>
            );
          })}
          <p className="hf-type-small text-text-secondary">
            Generel baggrundsinformation baseret på EFSA/EU-kilder — ikke personlig kostrådgivning.
          </p>
        </div>
      )}
    </HfScreen>
  );
}

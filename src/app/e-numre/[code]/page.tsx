"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { IconExternalLink, IconFlask } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { getAdditiveInfo, type AdditiveInfo } from "@/lib/additives";
import { additiveAlternativeSources, normalizeENumber } from "@/lib/additive-sources";

// Detaljeside for ét E-nummer (opgave #34): navn, forklaring, risici,
// forskning, primær kilde og alternative troværdige kilder.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-hf-tan p-4">
      <p className="hf-type-small text-text-secondary hf-heading uppercase">{title}</p>
      <div className="hf-type-body mt-1 text-hf-black">{children}</div>
    </section>
  );
}

export default function AdditiveDetailPage() {
  const params = useParams<{ code: string }>();
  const code = normalizeENumber(params.code ?? "");
  const [info, setInfo] = useState<AdditiveInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdditiveInfo(code).then((result) => {
      if (!cancelled) setInfo(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const sources = info ? additiveAlternativeSources(code, info.internationalName, info.link) : [];

  return (
    <HfScreen title={code} icon={<IconFlask size={20} stroke={2} />} alwaysShowBackButton>
      <div className="hf-page flex flex-col gap-3">
        {!info ? (
          <p className="hf-type-body text-text-secondary text-center">Henter...</p>
        ) : (
          <>
            <Section title="Navn">
              <p className="hf-heading">{info.internationalName}</p>
              {info.danishName && <p className="text-text-secondary">{info.danishName}</p>}
            </Section>
            {info.function && (
              <Section title="Forklaring">
                <p>{info.function}</p>
              </Section>
            )}
            {info.risks && (
              <Section title="Risici og relevante oplysninger">
                <p>{info.risks}</p>
              </Section>
            )}
            {info.research && (
              <Section title="Forskning">
                <p>{info.research}</p>
              </Section>
            )}
            {info.link && (
              <Section title="Primær kilde">
                <a
                  href={info.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-hf-green underline underline-offset-2"
                >
                  {info.source || "Kilde"} <IconExternalLink size={14} />
                </a>
              </Section>
            )}
            <Section title="Alternative kilder">
              <ul className="flex flex-col gap-2">
                {sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-hf-green underline underline-offset-2"
                    >
                      {source.label} <IconExternalLink size={14} />
                    </a>
                    <p className="hf-type-small text-text-secondary">{source.description}</p>
                  </li>
                ))}
              </ul>
            </Section>
            <p className="hf-type-small text-text-secondary">
              Generel baggrundsinformation baseret på EFSA/EU-kilder — ikke personlig
              kostrådgivning.
            </p>
          </>
        )}
      </div>
    </HfScreen>
  );
}

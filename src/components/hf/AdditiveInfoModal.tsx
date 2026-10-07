"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { getAdditiveInfo, type AdditiveInfo } from "@/lib/additives";

export function AdditiveInfoModal({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
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

  return (
    <BottomSheet ariaLabel={`${code.toUpperCase()}${info?.internationalName ? ` · ${info.internationalName}` : ""}`} onClose={onClose}>
        <div className="p-4">
          <p className="hf-type-body hf-heading mb-3 text-hf-black">{`${code.toUpperCase()}${info?.internationalName ? ` · ${info.internationalName}` : ""}`}</p>
          {!info ? (
            <p className="hf-type-body text-text-secondary">Henter...</p>
          ) : (
            <div className="flex flex-col gap-4">
              {info.danishName && (
                <p className="hf-type-small text-text-secondary">{info.danishName}</p>
              )}
              {info.function && (
                <p className="hf-type-body text-hf-black">{info.function}</p>
              )}
              {info.risks && (
                <div>
                  <p className="hf-type-small text-text-secondary hf-heading uppercase">
                    Risici
                  </p>
                  <p className="hf-type-body text-hf-black">{info.risks}</p>
                </div>
              )}
              {info.research && (
                <div>
                  <p className="hf-type-small text-text-secondary hf-heading uppercase">
                    Forskning
                  </p>
                  <p className="hf-type-body text-hf-black">{info.research}</p>
                </div>
              )}
              {info.link && (
                <a
                  href={info.link}
                  target="_blank"
                  rel="noreferrer"
                  className="hf-type-small text-hf-green underline underline-offset-2"
                >
                  Læs mere ({info.source || "kilde"})
                </a>
              )}
              <Link
                href={`/e-numre/${encodeURIComponent(code.toUpperCase())}`}
                className="hf-type-small hf-heading text-hf-green underline underline-offset-2"
              >
                Læs hele beskrivelsen med forskning og kilder om stoffet
              </Link>
            </div>
          )}
          <p className="hf-type-small text-text-secondary mt-4">
            Generel baggrundsinformation baseret på EFSA/EU-kilder — ikke personlig
            kostrådgivning.
          </p>
        </div>
    </BottomSheet>
  );
}

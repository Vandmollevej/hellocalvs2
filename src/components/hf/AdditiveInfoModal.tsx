"use client";

import { useEffect, useState } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-hf-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-hf-black/10 bg-hf-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hf-tan-dark px-4 py-3">
          <p className="hf-type-body hf-heading text-hf-black">
            {code.toUpperCase()}
            {info?.internationalName ? ` · ${info.internationalName}` : ""}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tilbage"
            className="flex h-7 w-7 items-center justify-center rounded-full text-hf-black"
          >
            <IconArrowLeft size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
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
            </div>
          )}
          <p className="hf-type-small text-text-secondary mt-4">
            Generel baggrundsinformation baseret på EFSA/EU-kilder — ikke personlig
            kostrådgivning.
          </p>
        </div>
      </div>
    </div>
  );
}

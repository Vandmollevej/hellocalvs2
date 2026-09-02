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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-hf-black/10 bg-hf-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hf-tan-dark px-4 py-3">
          <p className="hf-heading text-[15px] text-hf-black">
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
            <p className="text-[14px] text-hf-black opacity-60">Henter...</p>
          ) : (
            <div className="flex flex-col gap-3">
              {info.danishName && (
                <p className="text-[13px] text-hf-black opacity-70">{info.danishName}</p>
              )}
              {info.function && (
                <p className="text-[14px] leading-relaxed text-hf-black">{info.function}</p>
              )}
              {info.risks && (
                <div>
                  <p className="hf-heading text-[12px] uppercase text-hf-black opacity-50">
                    Risici
                  </p>
                  <p className="text-[14px] leading-relaxed text-hf-black">{info.risks}</p>
                </div>
              )}
              {info.research && (
                <div>
                  <p className="hf-heading text-[12px] uppercase text-hf-black opacity-50">
                    Forskning
                  </p>
                  <p className="text-[14px] leading-relaxed text-hf-black">{info.research}</p>
                </div>
              )}
              {info.link && (
                <a
                  href={info.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] text-hf-green underline underline-offset-2"
                >
                  Læs mere ({info.source || "kilde"})
                </a>
              )}
            </div>
          )}
          <p className="mt-4 text-[12px] leading-relaxed text-hf-black opacity-50">
            Generel baggrundsinformation baseret på EFSA/EU-kilder — ikke personlig
            kostrådgivning.
          </p>
        </div>
      </div>
    </div>
  );
}

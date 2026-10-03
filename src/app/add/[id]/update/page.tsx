"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

// Opdater varen (brugerbeslutning 2026-10-03): banneret på varesiden fører
// hertil. Et kort pr. manglende ting; fotoet tages med enhedens kamera,
// læses af AI på serveren (POST /api/products/[id]/update) og giver points
// første gang noget bliver udfyldt.
type Kind = "FRONT" | "NUTRITION" | "INGREDIENTS";
type Outcome = "done" | "unreadable" | "error";

const KIND_KEYS: Record<Kind, { title: "productUpdate.kindFront" | "productUpdate.kindNutrition" | "productUpdate.kindIngredients"; hint: "productUpdate.hintFront" | "productUpdate.hintNutrition" | "productUpdate.hintIngredients" }> = {
  FRONT: { title: "productUpdate.kindFront", hint: "productUpdate.hintFront" },
  NUTRITION: { title: "productUpdate.kindNutrition", hint: "productUpdate.hintNutrition" },
  INGREDIENTS: { title: "productUpdate.kindIngredients", hint: "productUpdate.hintIngredients" },
};

const MAX_EDGE_PX = 1600;

function readFileAsJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_EDGE_PX / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    image.src = url;
  });
}

export default function ProductUpdatePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [kinds, setKinds] = useState<Kind[] | null>(null);
  const [points, setPoints] = useState(20);
  const [workingKind, setWorkingKind] = useState<Kind | null>(null);
  const [outcomes, setOutcomes] = useState<Partial<Record<Kind, Outcome>>>({});
  const [earned, setEarned] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingKindRef = useRef<Kind | null>(null);
  const productHref = `/add/${encodeURIComponent(id)}`;

  useEffect(() => {
    fetch(`/api/products/${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((data) => {
        const offer = data.product?.updateOffer as { kinds: Kind[]; points: number } | null | undefined;
        setKinds(offer?.kinds ?? []);
        if (offer) setPoints(offer.points);
      })
      .catch(() => setKinds([]));
  }, [id]);

  function startCapture(kind: Kind) {
    pendingKindRef.current = kind;
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const kind = pendingKindRef.current;
    event.target.value = "";
    if (!file || !kind) return;

    setWorkingKind(kind);
    try {
      const photo = await readFileAsJpegDataUrl(file);
      const res = await fetch(`/api/products/${encodeURIComponent(id)}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, photo }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { accepted: boolean; pointsAwarded?: number };
      setOutcomes((current) => ({ ...current, [kind]: data.accepted ? "done" : "unreadable" }));
      if (data.pointsAwarded) setEarned((current) => current + data.pointsAwarded!);
    } catch {
      setOutcomes((current) => ({ ...current, [kind]: "error" }));
    } finally {
      setWorkingKind(null);
    }
  }

  return (
    <HfScreen title={t("productUpdate.title")}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="hf-page">
        {earned > 0 && (
          <p className="hf-type-body hf-type-strong text-hf-black text-center">
            {t("productUpdate.earned", { points: earned })}
          </p>
        )}
        {kinds !== null && kinds.length === 0 && earned === 0 && (
          <p className="hf-type-body text-text-secondary text-center">{t("productUpdate.nothingMissing")}</p>
        )}
        {(kinds ?? []).map((kind) => {
          const outcome = outcomes[kind];
          return (
            <div key={kind} className="hf-card">
              <p className="hf-type-body hf-type-strong text-hf-black">
                {t(KIND_KEYS[kind].title, { points })}
              </p>
              <p className="hf-type-small text-text-secondary">{t(KIND_KEYS[kind].hint)}</p>
              {outcome === "done" ? (
                <p className="hf-type-small hf-type-strong text-hf-black">{t("productUpdate.done")}</p>
              ) : (
                <>
                  {outcome === "unreadable" && (
                    <p className="hf-type-small text-text-secondary">{t("productUpdate.unreadable")}</p>
                  )}
                  {outcome === "error" && (
                    <p className="hf-type-small text-text-secondary">{t("productUpdate.error")}</p>
                  )}
                  <button
                    type="button"
                    disabled={workingKind !== null}
                    onClick={() => startCapture(kind)}
                    className="hf-control hf-btn-primary w-full disabled:opacity-60"
                  >
                    {workingKind === kind ? t("productUpdate.reading") : t("productUpdate.takePhoto")}
                  </button>
                </>
              )}
            </div>
          );
        })}
        <Link href={productHref} replace className="hf-control hf-btn-secondary w-full justify-center">
          {t("productUpdate.back")}
        </Link>
      </div>
    </HfScreen>
  );
}

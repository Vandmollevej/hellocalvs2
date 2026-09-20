"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

// Kvalitetskontrol/billed-match (docs/DECISIONS.md 2026-09-19): den simplest
// mulige rigtige kamera-indsendelse — <input capture="environment"> åbner
// enhedens kamera direkte, uden at genbruge det store guidede
// /camera/create-flow, som er bygget til en helt anden opgave (produkt-
// oprettelse, ikke et enkelt erstatningsbillede for en eksisterende award).
type Award = { id: string; photoType: "BARCODE" | "NUTRITION" | "INGREDIENTS"; points: number };

const PHOTO_TYPE_KEY: Record<Award["photoType"], "photoAward.photoTypeBarcode" | "photoAward.photoTypeNutrition" | "photoAward.photoTypeIngredients"> = {
  BARCODE: "photoAward.photoTypeBarcode",
  NUTRITION: "photoAward.photoTypeNutrition",
  INGREDIENTS: "photoAward.photoTypeIngredients",
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PhotoAwardPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [awards, setAwards] = useState<Award[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submittedIds, setSubmittedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAwardIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/products/${id}/photo-awards`)
      .then((res) => res.json())
      .then((data) => setAwards(data.awards ?? []))
      .catch(() => setAwards([]));
  }, [id]);

  function startCapture(awardId: string) {
    pendingAwardIdRef.current = awardId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const awardId = pendingAwardIdRef.current;
    event.target.value = "";
    if (!file || !awardId) return;

    setSubmittingId(awardId);
    setError(null);
    try {
      const photo = await readFileAsDataUrl(file);
      const res = await fetch(`/api/photo-awards/${awardId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo }),
      });
      if (!res.ok) throw new Error();
      setSubmittedIds((current) => [...current, awardId]);
    } catch {
      setError(t("photoAward.submitError"));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <HfScreen title={t("photoAward.title")} onBack={() => router.back()}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex flex-col gap-3 p-4">
        {awards.map((award) => {
          const submitted = submittedIds.includes(award.id);
          return (
            <div key={award.id} className="flex flex-col gap-2 rounded-2xl bg-hf-tan p-4">
              <p className="text-sm font-medium text-hf-black">
                {t("photoAward.pointsForPhoto", { points: award.points, photoType: t(PHOTO_TYPE_KEY[award.photoType]) })}
              </p>
              {submitted ? (
                <p className="text-[13px] text-hf-black opacity-70">{t("photoAward.submitted")}</p>
              ) : (
                <button
                  type="button"
                  disabled={submittingId === award.id}
                  onClick={() => startCapture(award.id)}
                  className="hf-btn-primary w-full py-2.5 text-[14px] disabled:opacity-60"
                >
                  {submittingId === award.id ? t("photoAward.submitting") : t("photoAward.takePhoto")}
                </button>
              )}
            </div>
          );
        })}
        {error && <p className="text-center text-sm text-hf-black opacity-70">{error}</p>}
      </div>
    </HfScreen>
  );
}

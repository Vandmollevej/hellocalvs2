"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

type Registration = {
  id: string;
  titleSnapshot: string;
  kcalSnapshot: number;
  proteinSnapshot: number;
  carbsSnapshot: number;
  fatSnapshot: number;
  amountGrams: number;
  product: {
    imageUrl: string | null;
    servingSizeGrams: number | null;
    servingSizeUnitSingular: string | null;
    servingSizeUnitPlural: string | null;
  } | null;
};

function MacroBar({ label, grams, max }: { label: string; grams: number; max: number }) {
  const pct = Math.min(100, (grams / max) * 100);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] text-hf-black opacity-70">{label}</span>
        <span className="min-w-[36px] text-right text-base font-bold text-hf-black">
          {Math.round(grams * 10) / 10} g
        </span>
      </div>
      <div className="relative h-2 rounded bg-hf-tan-dark">
        <div className="absolute inset-y-0 left-0 rounded bg-hf-green" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function RegistrationPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [status, setStatus] = useState<"loading" | "not_found" | "error" | "loaded">("loading");

  useEffect(() => {
    fetch(`/api/registrations/${id}`)
      .then(async (res) => {
        if (res.status === 404) return setStatus("not_found");
        if (!res.ok) return setStatus("error");
        const data = await res.json();
        setRegistration(data.registration);
        setStatus("loaded");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  if (status !== "loaded" || !registration) {
    const message =
      status === "loading"
        ? t("registration.loading")
        : status === "not_found"
          ? t("registration.notFound")
          : t("registration.loadError");

    return (
      <HfScreen title={t("addProduct.title")}>
        <p className="p-4 text-center text-sm text-hf-black opacity-60">{message}</p>
      </HfScreen>
    );
  }

  return (
    <HfScreen title={t("addProduct.title")}>
      <div className="flex h-44 items-center justify-center bg-hf-tan">
        {registration.product?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={registration.product.imageUrl} alt="" className="h-full w-full object-contain p-3" />
        )}
      </div>

      <div className="hf-page">
        <h1 className="hf-heading text-lg text-hf-black">{registration.titleSnapshot}</h1>
        <p className="text-sm text-hf-black opacity-70">
          {registration.amountGrams > 0
            ? Math.round((registration.kcalSnapshot / registration.amountGrams) * 100)
            : Math.round(registration.kcalSnapshot)}{" "}
          kcal {t("registration.per100g")}
        </p>
        {(() => {
          const { servingSizeGrams, servingSizeUnitSingular, servingSizeUnitPlural } =
            registration.product ?? {};
          if (!servingSizeGrams || servingSizeGrams <= 0 || !servingSizeUnitSingular) return null;
          const count = registration.amountGrams / servingSizeGrams;
          const unitLabel =
            Math.abs(count - 1) < 0.05 ? servingSizeUnitSingular : (servingSizeUnitPlural ?? servingSizeUnitSingular);
          const roundedCount = Math.round(count * 10) / 10;
          const kcalForCount = Math.round(registration.kcalSnapshot);
          return (
            <p className="text-sm text-hf-black opacity-70">
              {kcalForCount} kcal {t("registration.perUnit", { unit: `${roundedCount} ${unitLabel}` })}
            </p>
          );
        })()}

        <div className="hf-card hf-card--form">
          <p className="hf-heading text-[15px] text-hf-black">{t("common.macroBreakdown")}</p>
          <MacroBar label={t("common.protein")} grams={registration.proteinSnapshot} max={40} />
          <MacroBar label={t("common.carbs")} grams={registration.carbsSnapshot} max={80} />
          <MacroBar label={t("common.fat")} grams={registration.fatSnapshot} max={30} />
        </div>
      </div>
    </HfScreen>
  );
}

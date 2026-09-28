"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { ProductImageCircle } from "@/components/ProductImageCircle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { Skeleton, SkeletonCards, SkeletonScreen, SkeletonText } from "@/components/hf/Skeleton";

type Registration = {
  id: string;
  titleSnapshot: string;
  kcalSnapshot: number;
  proteinSnapshot: number;
  carbsSnapshot: number;
  fatSnapshot: number;
  amountGrams: number;
  createdAt: string;
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
        <span className="hf-type-small text-text-secondary">{label}</span>
        <span className="hf-type-body hf-type-strong min-w-[36px] text-right text-hf-black">
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
  const { t, locale } = useTranslation();
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
        {status === "loading" ? (
          <SkeletonScreen className="flex flex-col gap-4">
            <div className="flex justify-center p-4 pt-6">
              <Skeleton type="image" width={190} height={190} style={{ borderRadius: "9999px" }} />
            </div>
            <div className="flex flex-col gap-4 px-4">
              <Skeleton type="page-title" width="70%" />
              <SkeletonText lines={2} />
              <SkeletonCards count={2} height={72} />
            </div>
          </SkeletonScreen>
        ) : (
          <p className="hf-type-body text-text-secondary p-4 text-center">{message}</p>
        )}
      </HfScreen>
    );
  }

  return (
    <HfScreen title={t("addProduct.title")}>
      {/* Samme faste billedcirkel som produktskærmen — ens højde med og uden billede. */}
      <div className="flex justify-center p-4 pt-6">
        <ProductImageCircle imageUrl={registration.product?.imageUrl ?? null} />
      </div>

      <div className="hf-page">
        <h1 className="hf-type-body-lg hf-heading text-hf-black">{registration.titleSnapshot}</h1>
        <p className="hf-type-body text-text-secondary">
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
            <p className="hf-type-body text-text-secondary">
              {kcalForCount} kcal {t("registration.perUnit", { unit: `${roundedCount} ${unitLabel}` })}
            </p>
          );
        })()}

        {/* Tidspunkt hører til den konkrete registrering (ikke varen): enkel
            overskrift med klokkeslættet lige under — ingen streger. */}
        <div className="text-center">
          <p className="hf-type-body hf-heading text-hf-black">{t("common.timeHeading")}</p>
          <p className="hf-type-body text-hf-black">
            {new Date(registration.createdAt).toLocaleTimeString(locale === "da" ? "da-DK" : "en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        <div className="hf-card hf-card--form">
          <p className="hf-type-body hf-heading text-hf-black">{t("common.macroBreakdown")}</p>
          <MacroBar label={t("common.protein")} grams={registration.proteinSnapshot} max={40} />
          <MacroBar label={t("common.carbs")} grams={registration.carbsSnapshot} max={80} />
          <MacroBar label={t("common.fat")} grams={registration.fatSnapshot} max={30} />
        </div>
      </div>
    </HfScreen>
  );
}

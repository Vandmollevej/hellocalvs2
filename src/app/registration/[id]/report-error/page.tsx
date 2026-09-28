"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { ProductImageCircle } from "@/components/ProductImageCircle";
import { ReportBugForm } from "@/components/ReportBugForm";
import { Skeleton, SkeletonScreen } from "@/components/hf/Skeleton";
import { useTranslation } from "@/i18n/LocaleProvider";

type Registration = {
  id: string;
  productId: string | null;
  titleSnapshot: string;
  product: { imageUrl: string | null } | null;
};

// "Fejl"-swipe på en dagbogsregistrering (src/components/SwipeableRow.tsx).
// Viser varen med samme billedcirkel og overskrift som registrerings-/
// produktskærmen, efterfulgt af den fælles fejlindberetningsformular knyttet
// til registreringens produkt.
export default function RegistrationReportErrorPage() {
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

  return (
    <HfScreen title={t("registrationReportError.title")}>
      {status === "loading" ? (
        <SkeletonScreen className="flex flex-col gap-4">
          <div className="flex justify-center p-4 pt-6">
            <Skeleton type="image" width={190} height={190} style={{ borderRadius: "9999px" }} />
          </div>
          <div className="px-4">
            <Skeleton type="page-title" width="70%" />
          </div>
        </SkeletonScreen>
      ) : status !== "loaded" || !registration ? (
        <p className="hf-type-body text-text-secondary p-4 text-center">
          {status === "not_found" ? t("registration.notFound") : t("registration.loadError")}
        </p>
      ) : (
        <>
          <div className="flex justify-center p-4 pt-6">
            <ProductImageCircle imageUrl={registration.product?.imageUrl ?? null} />
          </div>
          <h1 className="hf-type-body-lg hf-heading px-4 text-center text-hf-black">
            {registration.titleSnapshot}
          </h1>
          <ReportBugForm productId={registration.productId} />
        </>
      )}
    </HfScreen>
  );
}

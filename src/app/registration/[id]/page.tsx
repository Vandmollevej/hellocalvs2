"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { Skeleton, SkeletonCards, SkeletonScreen, SkeletonText } from "@/components/hf/Skeleton";
import { AddProductView, type EditableRegistration } from "@/components/add/AddProductView";

type Registration = EditableRegistration & {
  productId: string | null;
  genericIngredientId: string | null;
};

// En allerede tilføjet registrering: samme visning som "Tilføj produkt", så
// mængde, tidspunkt og energifordeling stadig kan ændres og gemmes.
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

  if (status === "loaded" && registration) {
    return (
      <AddProductView
        id={registration.productId ?? registration.genericIngredientId ?? ""}
        forDish={false}
        registration={registration}
      />
    );
  }

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
            <Skeleton className="rounded-full" type="image" width={190} height={190} />
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

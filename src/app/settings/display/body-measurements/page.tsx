"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { SkeletonScreen, SkeletonToggle } from "@/components/hf/Skeleton";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  BODY_MEASUREMENT_FIELDS,
  isBodyMeasurementVisible,
  type BodyMeasurementField,
  type BodyMeasurementVisibility,
} from "@/lib/body-measurements";

// Indstillinger → Visning → Kropsmål: brugeren vælger selv, hvilke kropsmål
// Kropsmål-siden viser. Gemmes løbende, uden "Gem"-knap.
export default function BodyMeasurementsDisplayPage() {
  const { t } = useTranslation();
  const [visibility, setVisibility] = useState<BodyMeasurementVisibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as {
          user: { bodyMeasurementVisibility: BodyMeasurementVisibility | null };
        };
      })
      .then((data) => {
        if (!cancelled) setVisibility(data.user.bodyMeasurementVisibility ?? {});
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(field: BodyMeasurementField, value: boolean) {
    const next = { ...(visibility ?? {}), [field]: value };
    setVisibility(next);
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyMeasurementVisibility: next }),
    }).catch(() => {});
  }

  return (
    <HfScreen title={t("settings.bodyMeasurementsDisplay")}>
      {loading ? (
        <SkeletonScreen>
          <SkeletonToggle count={BODY_MEASUREMENT_FIELDS.length} />
        </SkeletonScreen>
      ) : failed || !visibility ? (
        <p className="text-text-secondary hf-type-body p-6 text-center">{t("settings.loadError")}</p>
      ) : (
        <div className="hf-page">
          <p className="text-text-secondary hf-type-small px-1">
            {t("settings.bodyMeasurementsDisplayDescription")}
          </p>
          {BODY_MEASUREMENT_FIELDS.map(({ field, nameKey }) => (
            <Toggle
              key={field}
              label={t(nameKey)}
              checked={isBodyMeasurementVisible(visibility, field)}
              onChange={(value) => toggle(field, value)}
            />
          ))}
        </div>
      )}
    </HfScreen>
  );
}

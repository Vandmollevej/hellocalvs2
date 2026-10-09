"use client";

import { use, useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { ScreeningFlow } from "@/components/screenings/ScreeningFlow";
import { useTranslation } from "@/i18n/LocaleProvider";
import { fetchScreenings } from "@/lib/screenings-client";
import type { ScreeningDto } from "@/lib/screenings";
import { HfLoader } from "@/components/hf/HfLoader";

export default function EditScreeningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const [screening, setScreening] = useState<ScreeningDto | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchScreenings(t)
      .then((list) => {
        if (cancelled) return;
        const found = list.find((s) => s.id === id);
        if (found) setScreening(found);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (screening) return <ScreeningFlow existing={screening} />;
  return (
    <HfScreen title={t("screenings.editTitle")}>
      <div className="hf-page">
        {failed ? <p className="hf-type-body text-text-secondary">{t("screenings.loadError")}</p> : <HfLoader />}
      </div>
    </HfScreen>
  );
}

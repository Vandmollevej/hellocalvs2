"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconChevronRight, IconClipboardHeart } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { FoodRow } from "@/components/FoodRow";
import { HfLoader } from "@/components/hf/HfLoader";
import { useTranslation } from "@/i18n/LocaleProvider";
import { fetchScreenings } from "@/lib/screenings-client";
import type { ScreeningDto } from "@/lib/screenings";

// Screeningrapporter: alle screeninger (også inaktive) i madvare-rækkernes
// stil; hver række åbner rapporten med målingerne.
export default function ScreeningReportsPage() {
  const { t } = useTranslation();
  const [screenings, setScreenings] = useState<ScreeningDto[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchScreenings(t)
      .then(setScreenings)
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HfScreen title={t("screenings.reportsTitle")}>
      <div className="hf-page">
        {!screenings && !failed && (
          <div className="flex justify-center py-6">
            <HfLoader />
          </div>
        )}
        {failed && <p className="hf-type-body text-text-secondary">{t("screenings.loadError")}</p>}
        {screenings && screenings.length === 0 && (
          <p className="hf-type-body text-text-secondary">{t("screenings.reportsEmpty")}</p>
        )}
        {screenings && screenings.length > 0 && (
          <div className="hf-card !py-0">
            {screenings.map((screening, index) => (
              <div key={screening.id} className={index < screenings.length - 1 ? "border-b border-hf-tan-dark" : ""}>
                <Link href={`/profile/screenings/reports/${screening.id}`} className="block">
                  <FoodRow
                    thumbnail={<IconClipboardHeart size={22} />}
                    title={screening.name}
                    subtitle={
                      <p className="hf-type-small text-text-secondary">
                        {screening.active ? t("screenings.statusActive") : t("screenings.statusInactive")}
                      </p>
                    }
                    right={<IconChevronRight size={18} />}
                  />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </HfScreen>
  );
}

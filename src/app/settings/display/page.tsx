"use client";

import { useEffect, useState } from "react";
import {
  IconHome2,
  IconAlertTriangle,
  IconCalendarWeek,
  IconMoon,
  IconCalendarHeart,
  IconBulb,
  IconArrowsSort,
  IconRuler,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { useTranslation } from "@/i18n/LocaleProvider";

// Settings → Visning: overview of the display sub-pages (same rows as the
// "Visning" card on /settings). Menstruationscyklus only for sex = FEMALE.
export default function DisplaySettingsIndexPage() {
  const { t } = useTranslation();
  const [isFemale, setIsFemale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { user: { sex: "FEMALE" | "MALE" | null } };
      })
      .then((data) => {
        if (!cancelled) setIsFemale(data.user.sex === "FEMALE");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HfScreen title={t("settings.display")}>
      <div className="hf-page">
        <AccordionCard>
          <ChevronRow
            icon={<IconArrowsSort size={20} />}
            label={t("circleBadges.priorityTitle")}
            href="/settings/display/priority"
            divider
          />
          <ChevronRow
            icon={<IconHome2 size={20} />}
            label={t("settings.frontPage")}
            href="/settings/display/front-page"
            divider
          />
          <ChevronRow
            icon={<IconRuler size={20} />}
            label={t("settings.bodyMeasurementsDisplay")}
            href="/settings/display/body-measurements"
            divider
          />
          <ChevronRow
            icon={<IconAlertTriangle size={20} />}
            label={t("settings.recommendedLimits")}
            href="/settings/display/limits"
            divider
          />
          <ChevronRow
            icon={
              <span aria-hidden="true" className="hf-type-page-title w-5 text-center leading-none text-hf-green">
                ~
              </span>
            }
            label={t("displaySettings.uncertainty")}
            href="/settings/display/uncertainty"
            divider
          />
          <ChevronRow
            icon={<IconCalendarWeek size={20} />}
            label={t("settings.calendarView")}
            href="/settings/display/calendar-view"
            divider
          />
          <ChevronRow
            icon={<IconMoon size={20} />}
            label={t("settings.sleepQuality")}
            href="/settings/display/sleep-quality"
            divider
          />
          <ChevronRow
            icon={<IconBulb size={20} />}
            label={t("settings.tipsTitle")}
            href="/settings/display/tips"
            divider={isFemale}
          />
          {isFemale && (
            <ChevronRow
              icon={<IconCalendarHeart size={20} />}
              label={t("settings.menstrualCycle")}
              href="/settings/display/menstrual-cycle"
              divider={false}
            />
          )}
        </AccordionCard>
      </div>
    </HfScreen>
  );
}

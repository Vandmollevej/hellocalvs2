"use client";

import { HfScreen } from "@/components/HfScreen";
import {
  DEFAULT_CALENDAR_VIEW,
  saveDefaultCalendarView,
  useDefaultCalendarView,
  type CalendarDefaultView,
} from "@/lib/calendar-view-pref";
import { useTranslation } from "@/i18n/LocaleProvider";

const OPTIONS: { value: CalendarDefaultView; labelKey: string }[] = [
  { value: "list", labelKey: "calendarViewSettings.optionList" },
  { value: "month", labelKey: "calendarViewSettings.optionMonth" },
  { value: "week", labelKey: "calendarViewSettings.optionWeek" },
  { value: "day", labelKey: "calendarViewSettings.optionDay" },
];

export default function CalendarViewDisplaySettingsPage() {
  const { t } = useTranslation();
  const selectedView = useDefaultCalendarView();

  return (
    <HfScreen title={t("calendarViewSettings.title")}>
      <div className="hf-page">
        <p className="hf-type-small text-text-secondary px-1">
          {t("calendarViewSettings.intro")}
        </p>

        {/* Én af flere værdier kan ikke være til/fra — derfor en dropdown. */}
        <div className="overflow-hidden rounded-2xl bg-hf-tan">
          <label className="hf-control-row flex items-center gap-4 px-4">
            <span className="hf-type-body flex-1">{t("calendarViewSettings.title")}</span>
            <select
              value={selectedView ?? DEFAULT_CALENDAR_VIEW}
              onChange={(event) => saveDefaultCalendarView(event.target.value as CalendarDefaultView)}
              className="hf-type-body hf-type-strong cursor-pointer bg-transparent text-hf-green outline-none"
            >
              {OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </HfScreen>
  );
}

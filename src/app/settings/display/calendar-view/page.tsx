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
  { value: "month", labelKey: "calendarViewSettings.optionMonth" },
  { value: "week", labelKey: "calendarViewSettings.optionWeek" },
  { value: "list", labelKey: "calendarViewSettings.optionList" },
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

        <div className="flex flex-col gap-1 overflow-hidden rounded-2xl bg-hf-tan">
          {OPTIONS.map((option, index) => {
            const isSelected = (selectedView ?? DEFAULT_CALENDAR_VIEW) === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => saveDefaultCalendarView(option.value)}
                className={`hf-type-body hf-type-strong flex min-h-12 items-center px-4 text-left ${
                  index < OPTIONS.length - 1 ? "border-b border-hf-tan-dark" : ""
                } ${isSelected ? "text-hf-green" : "text-hf-black"}`}
              >
                <span className="flex-1">{t(option.labelKey)}</span>
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isSelected ? "border-hf-green" : "border-hf-gray"
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && <span className="size-2.5 rounded-full bg-hf-green" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </HfScreen>
  );
}

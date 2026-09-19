"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const selectedView = useDefaultCalendarView();

  return (
    <HfScreen title={t("calendarViewSettings.title")} onBack={() => router.back()}>
      <div className="flex flex-col gap-4 p-4">
        <p className="px-1 text-[13px] leading-5 text-hf-black opacity-70">
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
                className={`flex min-h-12 items-center px-4 text-left text-[14px] font-medium ${
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

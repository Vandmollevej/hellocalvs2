"use client";

import { IconChevronDown } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SLEEP_STAT_PERIODS, type SleepStatPeriodKey } from "@/lib/sleep-stats";

// Periodevalg på statistiksider er altid en dropdown, aldrig knapper.
export function StatPeriodSelect({
  value,
  onChange,
}: {
  value: SleepStatPeriodKey;
  onChange: (value: SleepStatPeriodKey) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <select
        aria-label={t("sleepStats.periodAria")}
        className="hf-select-surface hf-field hf-type-body"
        value={value}
        onChange={(event) => onChange(event.target.value as SleepStatPeriodKey)}
      >
        {SLEEP_STAT_PERIODS.map((key) => (
          <option key={key} value={key}>
            {t(`sleepStats.period.${key}`)}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={14}
        stroke={2.5}
        className="hf-select-chevron"
      />
    </div>
  );
}

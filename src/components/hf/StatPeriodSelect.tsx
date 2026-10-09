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
        className="hf-field hf-type-body w-full appearance-none rounded-xl border border-hf-tan-dark bg-hf-white pl-3 pr-9 text-hf-black"
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
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-hf-black"
      />
    </div>
  );
}

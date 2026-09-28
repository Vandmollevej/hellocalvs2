"use client";

import { useTranslation } from "@/i18n/LocaleProvider";

// Global Hello Cal-regel for redigerbart tidspunkt: overskriften "Tidspunkt"
// står alene (uden stiplede streger) med "Kl. 05.28" umiddelbart under, så
// der ikke opstår unødig luft. Brug altid denne.
export function TimeSection({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <section className={`flex w-full flex-col items-center ${className}`}>
      <h2 className="m-0 font-hf-heading text-[15px] font-bold leading-5 text-hf-black">{t("common.timeHeading")}</h2>
      <div className="flex justify-center">
        <label className="hf-type-body inline-flex items-center gap-1 px-4 text-hf-black">
          <span>{t("common.clockPrefix")}</span>
          <input
            type="time"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={t("common.timeHeading")}
            className="hf-type-body appearance-none border-0 bg-transparent p-0 text-hf-black outline-none"
          />
        </label>
      </div>
    </section>
  );
}

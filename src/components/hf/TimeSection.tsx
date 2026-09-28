"use client";

import { useTranslation } from "@/i18n/LocaleProvider";

// Tidspunkt for en konkret registrering: enkel "Tidspunkt"-overskrift med
// klokkeslættet umiddelbart under — ingen streger (punkt 33, 2026-09-28).
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
    <section className={`w-full ${className}`}>
      <h2 className="hf-type-body hf-heading text-center text-hf-black">{t("common.timeHeading")}</h2>
      <div className="flex justify-center">
        <label className="hf-type-body inline-flex min-h-8 items-center gap-1 px-4 text-hf-black">
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

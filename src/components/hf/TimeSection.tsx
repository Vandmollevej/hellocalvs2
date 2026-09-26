"use client";

import { useTranslation } from "@/i18n/LocaleProvider";

// Global Hello Cal-regel for redigerbart tidspunkt: overskriften "Tidspunkt"
// er den ene fælles overskrift med streger (.hf-type-section-title, design.md
// §4.3) med "Kl. 05.28" under. Erstatter den tidligere tunge beige bjælke —
// brug altid denne.
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
      <h2 className="hf-type-section-title">{t("common.timeHeading")}</h2>
      <div className="flex justify-center">
        <label className="hf-type-body inline-flex min-h-11 items-center gap-1 px-4 text-hf-black">
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

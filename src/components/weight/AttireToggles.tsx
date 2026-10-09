"use client";

import { useTranslation } from "@/i18n/LocaleProvider";
import { WEIGH_ATTIRES, type WeighAttire } from "@/lib/weigh-attire";

// Blok med on/off pr. tøj-valg: nøgen, undertøj, tøj, tøj + mobil i lommen.
// Ét valg ad gangen — tænder man et, slukkes de andre; slukker man det valgte,
// står vejningen uden bekræftet tøj.
export function AttireToggles({
  value,
  onChange,
  disabled = false,
}: {
  value: WeighAttire | null;
  onChange: (value: WeighAttire | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={t("weighIn.attireTitle")}>
      {WEIGH_ATTIRES.map((attire) => {
        const on = value === attire;
        return (
          <button
            key={attire}
            type="button"
            role="switch"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(on ? null : attire)}
            className="hf-control-row flex w-full items-center justify-between gap-3 rounded-xl bg-hf-white px-4 text-left disabled:opacity-50"
          >
            <span className="hf-type-body text-hf-black">{t(`weighIn.attire.${attire}`)}</span>
            <span
              aria-hidden="true"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-hf-green" : "bg-hf-tan-dark"}`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-hf-white transition-all ${on ? "left-[22px]" : "left-0.5"}`}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

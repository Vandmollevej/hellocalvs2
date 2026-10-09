"use client";

import { useTranslation } from "@/i18n/LocaleProvider";
import { ATTIRE_ITEMS, type AttireItem } from "@/lib/weigh-attire";

// Slidere med til/fra pr. tøj-valg: undertøj, bukser, top/t-shirt, sweater, sko,
// mobil m.m. i lommen og efter toiletbesøg. Flere kan vælges; intet valgt = nøgen.
export function AttireToggles({
  value,
  onChange,
  disabled = false,
}: {
  value: AttireItem[];
  onChange: (value: AttireItem[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={t("weighIn.attireTitle")}>
      {ATTIRE_ITEMS.map((item) => {
        const on = value.includes(item);
        return (
          <button
            key={item}
            type="button"
            role="switch"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(ATTIRE_ITEMS.filter((other) => (other === item ? !on : value.includes(other))))}
            className="hf-control-row flex w-full items-center justify-between gap-3 rounded-xl bg-hf-white px-4 text-left disabled:opacity-50"
          >
            <span className="hf-type-body text-hf-black">{t(`weighIn.attireItem.${item}`)}</span>
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
      {value.length === 0 && (
        <p className="hf-type-small text-center text-text-secondary">{t("weighIn.attireNaked")}</p>
      )}
    </div>
  );
}

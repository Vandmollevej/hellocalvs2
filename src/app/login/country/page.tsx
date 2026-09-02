"use client";

import Image from "next/image";
import Link from "next/link";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";

// Purely visually prepared list — no language/country selection logic yet.
// The order follows the flag images supplied in "Billeder til brug".
// "Denmark" is marked as the selected country until real country selection is built.
const SELECTED_COUNTRY = "denmark";

const COUNTRIES = [
  { key: "australien", flag: "australia" },
  { key: "belgien", flag: "belgium" },
  { key: "canada", flag: "canada" },
  { key: "danmark", flag: "denmark" },
  { key: "frankrig", flag: "france" },
  { key: "hollandEngelsk", flag: "netherlands-english" },
  { key: "irland", flag: "ireland" },
  { key: "italien", flag: "italy" },
  { key: "luxembourg", flag: "luxembourg" },
  { key: "nederlandene", flag: "netherlands" },
  { key: "newZealand", flag: "new-zealand" },
  { key: "norge", flag: "norway" },
  { key: "schweiz", flag: "switzerland" },
  { key: "spanien", flag: "spain" },
  { key: "storbritannien", flag: "united-kingdom" },
  { key: "sverige", flag: "sweden" },
  { key: "tyskland", flag: "germany" },
  { key: "usa", flag: "usa" },
  { key: "oestrig", flag: "austria" },
];

export default function CountryPickerPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="hf-appbar hf-appbar--brand"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <span className="hf-appbar__slot" aria-hidden="true" />
        <h1 className="hf-type-nav-title hf-appbar__title">{t("country.title")}</h1>
        <div className="hf-appbar__slot">
          <Link href="/login" aria-label={t("country.back")} className="text-hf-white">
            <IconArrowLeft size={24} />
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {COUNTRIES.map((country) => {
          const selected = country.flag === SELECTED_COUNTRY;
          return (
            <div
              key={country.flag}
              className="flex h-14 items-center gap-3 border-b border-hf-gray-border px-4"
            >
              <Image
                src={`/flags/${country.flag}.png`}
                alt=""
                width={36}
                height={27}
                className="rounded-[2px]"
              />
              <span className="hf-type-body flex-1">{t(`country.countries.${country.key}`)}</span>
              {selected && (
                <IconCheck size={20} stroke={2.5} className="text-hf-green" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

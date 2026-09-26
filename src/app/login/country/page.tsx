"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@tabler/icons-react";
import { HfChevron } from "@/components/hf/HfChevron";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  DEFAULT_LOGIN_COUNTRY,
  LOGIN_COUNTRIES,
  localeForCountry,
  readLoginCountry,
  storeLoginCountry,
} from "@/lib/login-country";

export default function CountryPickerPage() {
  const { t, setLocale } = useTranslation();
  const router = useRouter();
  const [selected, setSelected] = useState<string>(DEFAULT_LOGIN_COUNTRY);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage findes kun i browseren
    setSelected(readLoginCountry().flag);
  }, []);

  function choose(flag: string) {
    setSelected(flag);
    storeLoginCountry(flag);
    setLocale(localeForCountry(flag));
    router.push("/login");
  }

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="hf-appbar hf-appbar--brand"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <div className="hf-appbar__slot">
          <Link href="/login" aria-label={t("country.back")} className="flex h-full w-full items-center justify-center text-hf-white">
            <HfChevron direction="left" />
          </Link>
        </div>
        <h1 className="hf-type-nav-title hf-appbar__title">{t("country.title")}</h1>
        <span className="hf-appbar__slot" aria-hidden="true" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {LOGIN_COUNTRIES.map((country) => {
          const isSelected = country.flag === selected;
          return (
            <button
              type="button"
              key={country.flag}
              onClick={() => choose(country.flag)}
              aria-pressed={isSelected}
              className="flex h-14 w-full items-center gap-3 border-b border-hf-gray-border px-4 text-left"
            >
              <Image
                src={`/flags/${country.flag}.png`}
                alt=""
                width={36}
                height={27}
                className="rounded-[2px]"
              />
              <span className="hf-type-body flex-1">{t(`country.countries.${country.key}`)}</span>
              {isSelected && (
                <IconCheck size={20} stroke={2.5} className="text-hf-green" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

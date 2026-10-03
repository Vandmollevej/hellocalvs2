"use client";

import Image from "next/image";
import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  MEAL_INPUT_LANGUAGES,
  flagFor,
  getMealInputLanguage,
  type MealInputLanguageCode,
} from "@/lib/meal-input-language";

// Flaget i headerens venstre hjørne på tale- og chat-siden. Åbner et bundark
// (KRAV.md "Bundark") med sprogene; valget styrer både talegenkendelsen og
// AI-tolkningen.
export function MealLanguagePicker({
  language,
  region,
  onChange,
}: {
  language: MealInputLanguageCode;
  region: string | null;
  onChange: (code: MealInputLanguageCode) => void;
}) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const nameLocale = locale === "da" ? "da" : "en";
  const current = getMealInputLanguage(language);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("voice.language.button", { language: current.names[nameLocale] })}
        aria-haspopup="dialog"
        className="flex h-11 w-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-current"
      >
        <Image
          src={`/flags/${flagFor(language, region)}.png`}
          alt=""
          width={28}
          height={21}
          className="h-[21px] w-7 rounded-[3px] object-cover shadow-[0_0_0_1px_rgb(255_255_255_/_0.6)]"
        />
      </button>
      {open && (
        <BottomSheet title={t("voice.language.title")} onClose={() => setOpen(false)}>
          <p className="hf-type-small text-text-secondary px-4 pb-2">{t("voice.language.hint")}</p>
          <ul>
            {MEAL_INPUT_LANGUAGES.map((option) => {
              const selected = option.code === language;
              return (
                <li key={option.code}>
                  <BottomSheetCloseButton
                    onClick={() => onChange(option.code)}
                    className="hf-control-row flex w-full items-center gap-3 border-b border-hf-tan-dark px-4 text-left hover:bg-hf-tan"
                  >
                    <Image src={`/flags/${flagFor(option.code, region)}.png`} alt="" width={36} height={27} className="rounded-[2px]" />
                    <span className="hf-type-body flex-1 text-hf-black">{option.names[nameLocale]}</span>
                    {selected && <IconCheck size={20} stroke={2.5} className="text-hf-green" aria-label={t("voice.language.selected")} />}
                  </BottomSheetCloseButton>
                </li>
              );
            })}
          </ul>
        </BottomSheet>
      )}
    </>
  );
}

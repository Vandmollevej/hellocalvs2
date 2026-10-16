"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { useInWebShell } from "@/components/web/WebShell";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  MEAL_INPUT_LANGUAGES,
  countryCodeFor,
  flagFor,
  getMealInputLanguage,
  type MealInputLanguageCode,
} from "@/lib/meal-input-language";

type PickerProps = {
  language: MealInputLanguageCode;
  region: string | null;
  onChange: (code: MealInputLanguageCode) => void;
};

// Flaget til venstre for mikrofonen på madvaresiden og i headerens venstre
// hjørne på chat-siden. Åbner et bundark
// (KRAV.md "Bundark") med sprogene; valget styrer både talegenkendelsen og
// AI-tolkningen. I webvisningen er det en dropdown med landekoden ("DK") i
// stedet for flaget (brugerens ønske 2026-10-11).
export function MealLanguagePicker(props: PickerProps) {
  const inWebShell = useInWebShell();
  return inWebShell ? <WebLanguageDropdown {...props} /> : <SheetLanguagePicker {...props} />;
}

function SheetLanguagePicker({ language, region, onChange }: PickerProps) {
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
          <p className="hf-type-caption px-4 pb-2">{t("voice.language.hint")}</p>
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

// Webvisningen: "DK ▾" i headeren og en almindelig dropdown (.hf-menu, som
// profilmenuen) med landekode + sprognavn pr. række.
function WebLanguageDropdown({ language, region, onChange }: PickerProps) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nameLocale = locale === "da" ? "da" : "en";
  const current = getMealInputLanguage(language);

  // Luk ved klik udenfor og Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t("voice.language.button", { language: current.names[nameLocale] })}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hf-navrow hf-navrow--inline"
      >
        <span className="hf-type-strong">{countryCodeFor(language, region)}</span>
        <IconChevronDown size={16} stroke={1.75} />
      </button>
      {open && (
        <ul role="menu" className="hf-menu absolute left-0 top-full mt-1 w-56">
          {MEAL_INPUT_LANGUAGES.map((option) => {
            const selected = option.code === language;
            return (
              <li key={option.code} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    onChange(option.code);
                    setOpen(false);
                  }}
                  className={`hf-navrow ${selected ? "is-active" : ""}`}
                >
                  <span className="hf-type-strong w-7">{countryCodeFor(option.code, region)}</span>
                  <span className="flex-1">{option.names[nameLocale]}</span>
                  {selected && <IconCheck size={18} stroke={2.5} aria-label={t("voice.language.selected")} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect } from "react";
import type { Locale } from "@prisma/client";
import { t } from "@/lib/admin-i18n";
import { LOGIN_COUNTRIES, localeForCountry } from "@/lib/login-country";

// Land-/sprogvælger i admin (HelloFresh-stil): fuldskærm på mobil, centreret
// dialog på desktop hvor header og side stadig ses bag den. Danmark → DA,
// alle andre lande → EN (de eneste admin-sprog).

const COUNTRY_NAMES: Record<string, { DA: string; EN: string }> = {
  australia: { DA: "Australien", EN: "Australia" },
  belgium: { DA: "Belgien", EN: "Belgium" },
  canada: { DA: "Canada", EN: "Canada" },
  denmark: { DA: "Danmark", EN: "Denmark" },
  france: { DA: "Frankrig", EN: "France" },
  "netherlands-english": { DA: "Holland (engelsk)", EN: "Netherlands (English)" },
  ireland: { DA: "Irland", EN: "Ireland" },
  italy: { DA: "Italien", EN: "Italy" },
  luxembourg: { DA: "Luxembourg", EN: "Luxembourg" },
  netherlands: { DA: "Nederlandene", EN: "Netherlands" },
  "new-zealand": { DA: "New Zealand", EN: "New Zealand" },
  norway: { DA: "Norge", EN: "Norway" },
  switzerland: { DA: "Schweiz", EN: "Switzerland" },
  spain: { DA: "Spanien", EN: "Spain" },
  "united-kingdom": { DA: "Storbritannien", EN: "United Kingdom" },
  sweden: { DA: "Sverige", EN: "Sweden" },
  germany: { DA: "Tyskland", EN: "Germany" },
  usa: { DA: "USA", EN: "USA" },
  austria: { DA: "Østrig", EN: "Austria" },
};

const STORAGE_KEY = "hello-cal-admin-country";

export function readAdminCountry(locale: Locale): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && localeForCountry(stored).toUpperCase() === locale) return stored;
  } catch {
    // localStorage utilgængelig — fald tilbage til sprogets standardland.
  }
  return locale === "DA" ? "denmark" : "united-kingdom";
}

export function AdminCountryDialog({
  locale,
  selected,
  onSelect,
  onClose,
}: {
  locale: Locale;
  selected: string;
  onSelect: (flag: string, next: Locale) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function choose(flag: string) {
    try {
      window.localStorage.setItem(STORAGE_KEY, flag);
    } catch {
      // Valget gælder stadig for sessionen.
    }
    onSelect(flag, localeForCountry(flag) === "da" ? "DA" : "EN");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={t(locale, "nav_country_title")}>
      <div className="absolute inset-0 hidden bg-hf-black/40 sm:block" onClick={onClose} />
      <div className="relative flex w-full flex-col bg-hf-white sm:max-h-[80vh] sm:max-w-md sm:overflow-hidden sm:rounded-lg sm:shadow-xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-hf-tan-dark px-4">
          <h2 className="hf-type-body hf-type-strong">{t(locale, "nav_country_title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(locale, "nav_country_close")}
            className="hf-btn-icon rounded-md text-text-secondary hover:bg-hf-tan"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
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
                className="hf-control-row flex w-full items-center gap-3 border-b border-hf-tan-dark px-4 text-left hover:bg-hf-tan"
              >
                <Image src={`/flags/${country.flag}.png`} alt="" width={36} height={27} className="rounded-[2px]" />
                <span className="hf-type-body flex-1">{COUNTRY_NAMES[country.flag]?.[locale] ?? country.flag}</span>
                {isSelected && (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-hf-green" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

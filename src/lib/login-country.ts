import type { Locale } from "@/i18n";

// Country picker on the login screen. The choice is kept on the device
// (the user isn't logged in yet) and decides the app language: Denmark → Danish,
// every other country → English (the only other supported language).

const STORAGE_KEY = "hello-cal-login-country";

export const DEFAULT_LOGIN_COUNTRY = "denmark";

// The order follows the flag images supplied in "Billeder til brug".
export const LOGIN_COUNTRIES = [
  { key: "australien", flag: "australia", code: "AU" },
  { key: "belgien", flag: "belgium", code: "BE" },
  { key: "canada", flag: "canada", code: "CA" },
  { key: "danmark", flag: "denmark", code: "DK" },
  { key: "frankrig", flag: "france", code: "FR" },
  { key: "hollandEngelsk", flag: "netherlands-english", code: "NL" },
  { key: "irland", flag: "ireland", code: "IE" },
  { key: "italien", flag: "italy", code: "IT" },
  { key: "luxembourg", flag: "luxembourg", code: "LU" },
  { key: "nederlandene", flag: "netherlands", code: "NL" },
  { key: "newZealand", flag: "new-zealand", code: "NZ" },
  { key: "norge", flag: "norway", code: "NO" },
  { key: "schweiz", flag: "switzerland", code: "CH" },
  { key: "spanien", flag: "spain", code: "ES" },
  { key: "storbritannien", flag: "united-kingdom", code: "GB" },
  { key: "sverige", flag: "sweden", code: "SE" },
  { key: "tyskland", flag: "germany", code: "DE" },
  { key: "usa", flag: "usa", code: "US" },
  { key: "oestrig", flag: "austria", code: "AT" },
] as const;

export type LoginCountry = (typeof LOGIN_COUNTRIES)[number];

export function findLoginCountry(flag: string | null | undefined): LoginCountry {
  return (
    LOGIN_COUNTRIES.find((country) => country.flag === flag) ??
    LOGIN_COUNTRIES.find((country) => country.flag === DEFAULT_LOGIN_COUNTRY)!
  );
}

export function readLoginCountry(): LoginCountry {
  try {
    return findLoginCountry(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return findLoginCountry(null);
  }
}

export function storeLoginCountry(flag: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, flag);
  } catch {
    // localStorage unavailable — the language change still applies this session.
  }
}

export function localeForCountry(flag: string): Locale {
  return flag === "denmark" ? "da" : "en";
}

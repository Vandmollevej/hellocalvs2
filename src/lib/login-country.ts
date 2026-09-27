import type { Locale } from "@/i18n";

// Country picker on the login screen. The choice is kept on the device
// (the user isn't logged in yet) and decides the app language: Denmark → Danish,
// every other country → English (the only other supported language).

const STORAGE_KEY = "hello-cal-login-country";

export const DEFAULT_LOGIN_COUNTRY = "denmark";

// The order follows the flag images supplied in "Billeder til brug".
export const LOGIN_COUNTRIES = [
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

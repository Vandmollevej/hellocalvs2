// Hvor og med hvilke telefonindstillinger en vare blev scannet. Læses fra
// forespørgslens headere (Accept-Language + værtens landeheader), så både
// web- og native-appen får det uden klientændringer.
export type ScanContext = {
  scannedCountry: string | null;
  scannedLanguage: string | null;
  scannedDeviceLocale: string | null;
};

export function readScanContext(req: Request): ScanContext {
  const first = (req.headers.get("accept-language") ?? "").split(",")[0]?.split(";")[0]?.trim() ?? "";
  const match = /^([A-Za-z]{2,3})(?:-[A-Za-z]{4})?(?:[-_]([A-Za-z]{2}))?$/.exec(first);
  const language = match ? match[1].toLowerCase() : null;
  const region = match?.[2]?.toUpperCase() ?? null;
  const header = (
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("x-country-code") ??
    ""
  ).trim().toUpperCase();
  const country = /^[A-Z]{2}$/.test(header) && header !== "XX" ? header : region;
  return {
    scannedCountry: country,
    scannedLanguage: language,
    scannedDeviceLocale: language ? (region ? `${language}-${region}` : language) : null,
  };
}

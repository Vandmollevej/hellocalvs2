// Fælles stilklasser og små hjælpere til partnersidens klientkomponenter.
export const INPUT = "hf-type-body h-10 w-full rounded-md border border-hf-tan-dark bg-hf-white px-3";
export const LABEL = "hf-type-caption";
export const dkk = (value: number) =>
  `${value.toLocaleString("da-DK", { maximumFractionDigits: 2 })} kr.`;
export const dateDa = (iso: string) =>
  new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" });
export const isoDate = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

// Samme knapper som resten af admin Partnere (PartnerManagers).
export const BTN = "hf-type-small rounded-md border border-hf-tan-dark px-3 py-1.5 text-text-secondary hover:bg-hf-tan disabled:opacity-50";
export const PRIMARY = "hf-type-small rounded-md bg-hf-black px-3 py-1.5 text-hf-white disabled:opacity-50";

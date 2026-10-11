// Fælles stilklasser og små hjælpere til partnersidens klientkomponenter.
export const INPUT = "hf-input hf-input--compact w-full";
export const LABEL = "hf-type-caption";
export const dkk = (value: number) =>
  `${value.toLocaleString("da-DK", { maximumFractionDigits: 2 })} kr.`;
export const dateDa = (iso: string) =>
  new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" });
export const isoDate = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

// Samme knapper som resten af admin Partnere (PartnerManagers).
export const BTN = "hf-btn-secondary hf-btn--compact hf-btn--inline";
export const PRIMARY = "hf-btn-brand hf-btn--compact hf-btn--inline";

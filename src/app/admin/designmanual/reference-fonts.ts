import { Roboto, Roboto_Condensed } from "next/font/google";

// Skrifter til HelloFresh-prøverne i designmanualen (kun admin).
// Roboto er forlæggets brødskrift. Forlæggets display-skrift (sandsynligvis
// Agrandir) er ikke fri, så Roboto Condensed ExtraBold står i stedet.
export const referenceBody = Roboto({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-ref-body",
  display: "swap",
});

export const referenceDisplay = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-ref-display",
  display: "swap",
});

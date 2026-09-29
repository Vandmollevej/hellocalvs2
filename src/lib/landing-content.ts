import { SUBSCRIPTION_PRICES_DKK, type SubscriptionPlan } from "@/lib/subscription-plans";

// Tekster og links til den offentlige forside (src/components/landing).
// Ren konstant-fil, så indholdet kan rettes uden at røre layoutet.

// Butikslinks. Skift til appens rigtige sider, når den er udgivet — QR-koderne
// på forsiden genereres automatisk ud fra de samme links.
export const APP_STORE_URL = "https://apps.apple.com/";
export const PLAY_STORE_URL = "https://play.google.com/store/apps";

export const LANDING_NAV = [
  { href: "#om", label: "Om appen" },
  { href: "#funktioner", label: "Funktioner" },
  { href: "#skaermbilleder", label: "Skærmbilleder" },
  { href: "#hello-doc", label: "Hello Doc" },
  { href: "#priser", label: "Priser" },
  { href: "#medier", label: "I medierne" },
] as const;

export type LandingIcon =
  | "barcode"
  | "database"
  | "scale"
  | "lock"
  | "droplet"
  | "chart"
  | "chef"
  | "users"
  | "heart";

export const HIGHLIGHTS: { icon: LandingIcon; title: string }[] = [
  { icon: "barcode", title: "Scan og registrér" },
  { icon: "database", title: "Dansk fødevaredatabase" },
  { icon: "scale", title: "Vægt og mål" },
  { icon: "lock", title: "Dine data er dine" },
];

export const FEATURES_LEFT: { icon: LandingIcon; title: string; text: string }[] = [
  { icon: "barcode", title: "Scan stregkoden", text: "Peg kameraet på varen, og kalorier og næringsindhold står klar på et øjeblik." },
  { icon: "droplet", title: "Vand og væske", text: "Hold øje med dagens væske med ét tryk — også kaffe, te og det du ellers drikker." },
  { icon: "chef", title: "Opskrifter og retter", text: "Gem dine egne retter, og del dem med andre. Næringsindholdet regnes ud for dig." },
];

export const FEATURES_RIGHT: { icon: LandingIcon; title: string; text: string }[] = [
  { icon: "chart", title: "Statistik der giver mening", text: "Se udviklingen i kalorier, vægt og næring over uger og måneder." },
  { icon: "users", title: "Hele familien", text: "Med Seriøs Familie får op til 5 personer hver deres profil under ét abonnement." },
  { icon: "heart", title: "Sundhedsdata", text: "Forbind aktiviteter og skridt, så forbrændingen tæller med i dagens regnskab." },
];

export type LandingPlan = {
  // null = Gratis (ingen betaling).
  plan: SubscriptionPlan | null;
  name: string;
  price: string;
  note: string;
  featured?: boolean;
  items: { text: string; included: boolean }[];
};

export const PLANS: LandingPlan[] = [
  {
    plan: null,
    name: "Gratis",
    price: "0 kr.",
    note: "for altid",
    items: [
      { text: "Kalorier, vand og vægt", included: true },
      { text: "Scan stregkoder", included: true },
      { text: "3 måneders historik", included: true },
      { text: "Statistik og fotodagbog", included: false },
      { text: "Integrationer", included: false },
    ],
  },
  {
    plan: "serious",
    name: "Seriøs",
    price: `${SUBSCRIPTION_PRICES_DKK.serious[1]} kr.`,
    note: "pr. måned",
    featured: true,
    items: [
      { text: "Alt i Gratis", included: true },
      { text: "Hele din historik", included: true },
      { text: "Statistik og fotodagbog", included: true },
      { text: "Delmål og egne visninger", included: true },
      { text: "Integrationer", included: true },
    ],
  },
  {
    plan: "family",
    name: "Seriøs Familie",
    price: `${SUBSCRIPTION_PRICES_DKK.family[1]} kr.`,
    note: "pr. måned",
    items: [
      { text: "Alt i Seriøs", included: true },
      { text: "Op til 5 personer", included: true },
      { text: "Børneprofiler", included: true },
      { text: "Egen konto til hver", included: true },
      { text: "Ingen reklamer for familien", included: true },
    ],
  },
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Er Hello Cal gratis?",
    a: "Ja. Du kan registrere mad, vand og vægt gratis. Seriøs giver dig hele historikken, statistik, fotodagbog og integrationer.",
  },
  {
    q: "Hvad sker der med mine data?",
    a: "Dine data er dine. Vi bruger dem kun til at levere Hello Cal til dig — aldrig til annoncer.",
  },
  {
    q: "Kan jeg bruge appen i hele familien?",
    a: `Ja. Seriøs Familie dækker op til 5 personer til ${SUBSCRIPTION_PRICES_DKK.family[1]} kr. om måneden, og hver person har sin egen konto.`,
  },
  {
    q: "Kan jeg opsige når som helst?",
    a: "Ja. Du betaler for den periode, du har valgt, og abonnementet løber blot perioden ud.",
  },
];

// "I medierne": omtale og bedømmelser. Tilføj kun rigtige citater og
// bedømmelser med kilde — sektionen (og menupunktet) vises først, når der er
// mindst én.
export type PressMention = {
  outlet: string;
  quote: string;
  url?: string;
  // Bedømmelse fra mediet/butikken, fx 5 af 6 eller 4.8 af 5.
  rating?: { value: number; max: number };
};

export const PRESS_MENTIONS: PressMention[] = [];

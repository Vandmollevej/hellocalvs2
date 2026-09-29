import type { IntegrationProvider } from "@prisma/client";
import type { SubscriptionPlan } from "@/lib/subscription-plans";

// Korte vilkårs-uddrag til "Vilkår og betingelser"-bjælken nederst på
// startguidens trin, abonnementssiderne og hver integrationsside
// (docs/DECISIONS.md 2026-09-27). Hvert uddrag har sin egen tekst og linker
// til det afsnit i /betingelser, hvor emnet er dækket. Ankrene skal findes
// som id'er på afsnittene i src/app/betingelser/page.tsx.

export const TERMS_ANCHORS = [
  { id: "parterne", label: "1. Parterne og aftalen" },
  { id: "hvad-er-hello-cal", label: "2. Hvad Hello Cal er og ikke er" },
  { id: "alder", label: "3. Alder" },
  { id: "konto", label: "4. Din konto" },
  { id: "opfoersel", label: "5. God opførsel" },
  { id: "indhold", label: "6. Indhold du bidrager med" },
  { id: "integrationer", label: "7. Forbindelser til andre apps og enheder" },
  { id: "pointsystem", label: "8. Pointsystem" },
  { id: "abonnement", label: "9. Abonnement og betaling" },
  { id: "fortrydelsesret", label: "10. Fortrydelsesret" },
  { id: "ansvar", label: "11. Ansvar" },
  { id: "ophoer", label: "12. Ophør" },
  { id: "aendringer", label: "13. Ændringer" },
  { id: "lovvalg", label: "14. Lovvalg og tvister" },
  { id: "kontakt", label: "15. Kontakt" },
] as const;

export type TermsAnchor = (typeof TERMS_ANCHORS)[number]["id"];
export const TERMS_ANCHOR_IDS: TermsAnchor[] = TERMS_ANCHORS.map((anchor) => anchor.id);

export type TermsHint = { anchor: TermsAnchor; paragraphs: string[] };

export function termsHref(anchor: TermsAnchor) {
  return `/betingelser#${anchor}`;
}

// Fritekst (fx fra guide-builderen) → afsnit; tomme linjer adskiller afsnit.
export function termsParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

// Startguidens trin (samme id'er som i OnboardingWizard).
export type OnboardingTermsStep = "sleep-pattern" | "shift-work" | "daily-log-preference" | "calendar-view" | "health-import";

export const ONBOARDING_TERMS: Record<OnboardingTermsStep, TermsHint> = {
  "sleep-pattern": {
    anchor: "hvad-er-hello-cal",
    paragraphs: [
      "Dit svar om søvnmønster bruges kun til at dele dit døgn rigtigt op i kalenderen og i dine tal. Det hører til din egen konto og deles ikke med andre.",
      "Du kan altid ændre svaret senere under Indstillinger.",
      "Hello Cal er et værktøj, ikke en læge. Søvn- og kalorietal er vejledende og erstatter ikke rådgivning fra en læge eller anden sundhedsperson.",
    ],
  },
  "shift-work": {
    anchor: "ansvar",
    paragraphs: [
      "Arbejder du på skiftehold, følger dit døgn ikke altid kalenderen. Svarer du ja, kan du registrere efter dine egne døgn i stedet for fra midnat til midnat.",
      "Beregninger af kalorier, søvn og energi bygger på det, du selv registrerer. De er vejledende og kan indeholde fejl, og vi kan ikke love fejlfri tal.",
      "Svaret kan ændres når som helst under Indstillinger.",
    ],
  },
  "daily-log-preference": {
    anchor: "hvad-er-hello-cal",
    paragraphs: [
      "Her vælger du, om din dag i Hello Cal starter og slutter ved dine arbejdstider eller ved dine sovetider.",
      "Valget ændrer kun, hvordan dine egne registreringer samles pr. dag. Selve registreringerne bliver ikke ændret eller slettet, og du kan skifte når som helst.",
    ],
  },
  "calendar-view": {
    anchor: "hvad-er-hello-cal",
    paragraphs: [
      "Valget af kalendervisning gemmes kun på denne enhed og bestemmer blot, hvordan kalenderen åbner.",
      "Du kan altid skifte visning i kalenderen eller ændre standarden under Indstillinger → Visning → Kalendervisning.",
    ],
  },
  "health-import": {
    anchor: "integrationer",
    paragraphs: [
      "Henter du data fra Apple Sundhed, Health Connect eller et ur, henter Hello Cal kun de datatyper, du selv slår til.",
      "Du kan slå hver datatype fra og afbryde forbindelsen når som helst under Indstillinger → Integrationer. Når du afbryder, henter vi ikke flere data.",
      "Data fra andre apps kan være forkerte, forsinkede eller mangle, og Hello Cal kan ikke stå inde for dem. Den anden app har sine egne vilkår.",
    ],
  },
};

export const SUBSCRIPTION_OVERVIEW_TERMS: TermsHint = {
  anchor: "abonnement",
  paragraphs: [
    "Du kan bruge Hello Cal gratis eller med et betalt abonnement. Pris, indhold og betalingsmåde står tydeligt, før du køber.",
    "Et betalt abonnement betales forud og fornyes automatisk, indtil du opsiger det. Det gælder også efter en gratis måned via points eller en gavekode.",
    "Du kan opsige når som helst med virkning fra udgangen af den periode, du har betalt for. Har du købt via App Store eller Google Play, opsiger du dér. Det stopper ikke abonnementet at slette appen.",
    "Går du ned til den gratis udgave, bliver historik ældre end 3 måneder skjult, men ikke slettet. Den kommer igen, hvis du opgraderer.",
  ],
};

export const SUBSCRIPTION_PLAN_TERMS: Record<SubscriptionPlan, TermsHint> = {
  serious: {
    anchor: "fortrydelsesret",
    paragraphs: [
      "Seriøs giver fuld adgang i den periode, du vælger: 1, 3 eller 12 måneder. Prisen for hele perioden betales forud, og abonnementet fornyes automatisk med samme periode, indtil du opsiger det.",
      "Du har 14 dages fortrydelsesret fra købet. Tager du abonnementet i brug med det samme, beder vi dig bekræfte det ved købet. Fortryder du alligevel, refunderer vi beløbet med fradrag for den del af perioden, du har brugt.",
      "Køb via App Store eller Google Play refunderes efter deres regler og kun af dem.",
    ],
  },
  family: {
    anchor: "abonnement",
    paragraphs: [
      "Seriøs Familie er et betalt abonnement for hele familien. Den, der betaler, opsætter familien og bestemmer, hvem der er med.",
      "Abonnementet betales forud for den periode, du vælger, og fornyes automatisk, indtil du opsiger det. Du kan opsige når som helst med virkning fra udgangen af den betalte periode.",
      "Du har 14 dages fortrydelsesret fra købet, på samme vilkår som for Seriøs.",
    ],
  },
};

export const REDEEM_POINTS_TERMS: TermsHint = {
  anchor: "pointsystem",
  paragraphs: [
    "300 points kan indløses til én gratis måned af det betalte abonnement, dog højst 12 gratis måneder i alt pr. konto.",
    "Points har ingen kontantværdi og kan ikke overdrages. Vi kan annullere points, der er optjent ved misbrug.",
    "Efter en gratis måned fornyes abonnementet automatisk, hvis du har et betalt abonnement, indtil du opsiger det.",
  ],
};

const INTEGRATION_COMMON =
  "Du vælger selv pr. datatype, hvad der hentes og sendes, og du kan afbryde forbindelsen når som helst. Data fra andre tjenester kan være forkerte eller mangle, og Hello Cal kan ikke stå inde for dem.";

const INTEGRATION_INTRO: Record<IntegrationProvider, string> = {
  APPLE_HEALTH:
    "Apple Sundhed forbindes via Hello Cal-appen på din iPhone med en enhedskode. Data bliver på din telefon, indtil appen sender de datatyper, du har slået til, til din Hello Cal-konto.",
  HEALTH_CONNECT:
    "Health Connect forbindes via Hello Cal-appen på din Android-telefon. Appen læser og skriver kun de datatyper, du har slået til her og givet lov til i Health Connect.",
  GOOGLE_HEALTH:
    "Google Health forbindes med dit Google-login. Hello Cal får kun adgang til de datatyper, du giver lov til hos Google og slår til på denne side.",
  SAMSUNG_HEALTH:
    "Samsung Health deler data med Hello Cal gennem Health Connect på din telefon. Det er derfor Health Connects tilladelser, der styrer, hvad Hello Cal kan se.",
  FITBIT:
    "Fitbit forbindes med dit Fitbit-login. Hello Cal henter kun vægt og aktiviteter, og kun dem, du har slået til. Vi sender ikke data tilbage til Fitbit.",
  WITHINGS:
    "Withings forbindes med dit Withings-login. Hello Cal henter vægt og fedtprocent fra din vægt, når du har slået det til. Vi sender ikke data tilbage til Withings.",
  GARMIN:
    "Garmin forbindes via Garmins egen deling. Hello Cal henter kun de datatyper, du har slået til, og sender ikke data tilbage til Garmin.",
  POLAR:
    "Polar forbindes med dit Polar-login. Hello Cal henter dine træninger, når du har slået det til. Vi sender ikke data tilbage til Polar.",
  STRAVA:
    "Strava forbindes med dit Strava-login. Hello Cal kan hente dine aktiviteter og, hvis du slår det til, sende aktiviteter fra Hello Cal til Strava. Det, der sendes til Strava, følger dine privatlivsindstillinger dér.",
};

export function integrationTerms(provider: IntegrationProvider): TermsHint {
  return {
    anchor: "integrationer",
    paragraphs: [
      INTEGRATION_INTRO[provider],
      INTEGRATION_COMMON,
      "Den anden tjeneste har sine egne vilkår og sin egen privatlivspolitik, som gælder for din brug af den.",
    ],
  };
}

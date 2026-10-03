import { FREE_TIER_RETENTION_DAYS, SUBSCRIPTION_PRICES_DKK } from "@/lib/subscription-plans";

// Videnskilden for hjælpe-chatbotten (docs/DECISIONS.md 2026-10-02). Bygget
// på Hjælpecentret (public/hjaelp.html). Chatbotten må kun svare ud fra
// denne tekst og må aldrig gætte (docs/AI.md "Grundprincipper") — ved tvivl
// tilbyder den en medarbejder. Opdatér her, når Hjælpecentret ændres.

// Links chatbotten må sende brugeren til. AI'en vælger kun blandt disse
// (enum i svar-skemaet), så den aldrig kan opfinde en adresse.
export const CHATBOT_LINKS = {
  "/profile/goals": { da: "Gå til Mål", en: "Go to Goals" },
  "/settings": { da: "Gå til Indstillinger", en: "Go to Settings" },
  "/search": { da: "Søg efter en madvare", en: "Search for a food" },
  "/camera?mode=product": { da: "Åbn kameraet", en: "Open the camera" },
  "/voice": { da: "Åbn mikrofonen", en: "Open the microphone" },
  "/camera/create": { da: "Opret en vare", en: "Create a product" },
  "/calendar": { da: "Gå til Kalender", en: "Go to Calendar" },
  "/create-dish": { da: "Opret en ret", en: "Create a dish" },
  "/profile/recipes": { da: "Gå til Retter", en: "Go to Dishes" },
  "/weight/create": { da: "Registrér vægt", en: "Log weight" },
  "/water/create": { da: "Registrér vand", en: "Log water" },
  "/profile/body-measurements": { da: "Gå til Kropsmål", en: "Go to Body measurements" },
  "/statistics": { da: "Gå til Statistik", en: "Go to Statistics" },
  "/settings/display/front-page": { da: "Tilpas forsiden", en: "Customise the front page" },
  "/forgot-password": { da: "Nulstil adgangskode", en: "Reset password" },
  "/profile/change-password": { da: "Skift adgangskode", en: "Change password" },
  "/profile/edit": { da: "Gå til Rediger profil", en: "Go to Edit profile" },
  "/profile/settings/language-region": { da: "Gå til Sprog og region", en: "Go to Language and region" },
  "/profile/notifications": { da: "Gå til Notifikationer", en: "Go to Notifications" },
  "/profile/subscription": { da: "Gå til Abonnement", en: "Go to Subscription" },
  "/settings/payment": { da: "Gå til Betaling", en: "Go to Payment" },
  "/privatlivspolitik": { da: "Læs privatlivspolitikken", en: "Read the privacy policy" },
  "/settings/hello-doc": { da: "Gå til Hello Doc", en: "Go to Hello Doc" },
  "/settings/support": { da: "Gå til Support", en: "Go to Support" },
  "/settings/integrations": { da: "Gå til Integrationer", en: "Go to Integrations" },
  "/profile/report-bug": { da: "Meld en fejl", en: "Report a bug" },
  "/settings/support/contact": { da: "Kontakt os", en: "Contact us" },
  "/profile/family": { da: "Gå til Familie", en: "Go to Family" },
  "/hjaelp.html": { da: "Åbn Hjælpecentret", en: "Open the Help centre" },
} as const satisfies Record<string, { da: string; en: string }>;

export type ChatbotLinkHref = keyof typeof CHATBOT_LINKS;
export const CHATBOT_LINK_HREFS = Object.keys(CHATBOT_LINKS) as ChatbotLinkHref[];

export function isChatbotLinkHref(value: unknown): value is ChatbotLinkHref {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CHATBOT_LINKS, value);
}

const serious = SUBSCRIPTION_PRICES_DKK.serious;
const family = SUBSCRIPTION_PRICES_DKK.family;

export const CHATBOT_KNOWLEDGE = `
# Hello Cal — viden til hjælpe-chatbotten

## Kom i gang
- Hello Cal hjælper dig med at holde styr på det, du spiser og drikker, så du kan følge kalorier og næringsstoffer dag for dag – sammen med fx vægt, vand, søvn og kropsmål.
- Mål: Under Mål (/profile/goals) kan du se dine mål, oprette et nyt og se kommende mål.
- Introduktionen kan ses igen: Indstillinger (/settings) → "Kontoopsætning" (og øverst på Profil, til alt er sat).

## Registrering af mad
- Tilføj mad: tryk på plus-knappen på forsiden. Her kan du søge efter en madvare (/search), scanne med kameraet, indtale med mikrofonen (/voice) eller vælge en af dine egne retter.
- Stregkode: tryk på plus-knappen og vælg kameraet (/camera?mode=product). Hold stregkoden inden for rammen, indtil den er læst. Kontrollér mængden og gem. Driller scanningen, så sørg for godt lys og hold telefonen roligt.
- Stemme: tryk på plus-knappen og vælg mikrofonen. Sig, hvad du har spist, så finder appen madvarerne.
- På computeren (web) skriver man i Chat i stedet for at tale.
- Varen findes ikke: opret den selv ved at tage billeder af emballagen og næringsdeklarationen (/camera/create).
- Slet en registrering: swipe på registreringen i dagens liste. Her kan du slette den, gemme varen som favorit eller melde en fejl i varens data.
- Flyt en registrering: i Kalenderen (/calendar) kan du trække registreringen hen til det rigtige tidspunkt.
- Uden internet: opretter du en vare uden forbindelse, gemmer appen den og sender den automatisk, så snart du er online igen.

## Retter
- Opret en ret (/create-dish): tilføj ingredienserne og antal portioner, så beregner appen næringsindholdet.
- Del retter: når du opretter retten, kan du vælge at dele den med andre brugere. Ingen personlige oplysninger deles. Indeholder retten dine egne ingredienser, kan den deles, når ingredienserne er godkendt.
- Under Retter (/profile/recipes) finder du både delte retter og dine egne.

## Vægt, vand og statistik
- Vægt: plus-knappen → vægt (/weight/create). Vand: plus-knappen → vand (/water/create).
- Kropsmål finder du under Profil (/profile/body-measurements).
- Udvikling over tid: Statistik (/statistics). Dine dage: Kalender (/calendar).
- Forsiden kan tilpasses under Indstillinger → Forside (/settings/display/front-page).

## Konto og login
- Glemt adgangskode: du får en e-mail med et link til at vælge en ny (/forgot-password).
- Skift adgangskode: under Profil, når du er logget ind (/profile/change-password).
- Ingen bekræftelsesmail: tjek spam-mappen. Mailen kan sendes igen via "Send igen" i banneret øverst i appen.
- Face ID: efter et almindeligt login bliver du tilbudt Face ID. Det kan også slås til under Rediger profil (/profile/edit). Face ID gælder kun den enhed, du slår det til på.
- Sprog: Indstillinger → Sprog og region (/profile/settings/language-region).
- Notifikationer: Indstillinger → Notifikationer (/profile/notifications).
- Luk konto: Profil → Profil (/profile/edit), linket "Luk konto" nederst på siden. Du logges ud, og et abonnement opsiges. Fortryder du, så log ind igen inden for 3 måneder — så er kontoen åben igen. Efter 3 måneder slettes dine personoplysninger.
- Slet dine data med det samme (ret til at blive glemt): Profil → Profil (/profile/edit), knappen "Slet mine data" nederst på siden. Det kan ikke fortrydes. Privatlivspolitikken beskriver, hvad der sker med data.

## Abonnement og betaling
- Gratis: appen kan bruges gratis med ${FREE_TIER_RETENTION_DAYS} dages historik.
- Seriøs: ${serious[1]} kr. for 1 måned, ${serious[3]} kr. for 3 måneder, ${serious[12]} kr. for 12 måneder.
- Seriøs Familie (op til 5 personer): ${family[1]} kr. for 1 måned, ${family[3]} kr. for 3 måneder, ${family[12]} kr. for 12 måneder. Alle i familien får Seriøs.
- Priserne er foreløbige. Den gældende pris står altid under Abonnement.
- Se abonnement og næste betalingsdato: Abonnement (/profile/subscription).
- Skift betalingsmetode: Betaling (/settings/payment).
- Stop abonnement: betaler du med MobilePay, kan du stoppe aftalen under Betaling. Ellers send en henvendelse via Kontakt os.
- Refusion, dobbelt betaling og fejl i opkrævning kan kun Support afgøre — tilbyd en medarbejder.

## Data og privatliv
- Helbredsdata og samtykke: se privatlivspolitikken (/privatlivspolitik), herunder hvordan samtykke trækkes tilbage.
- Hello Doc (/settings/hello-doc): inviter din læge eller diætist til at se dine data.
- Support kan intet se, medmindre du selv giver lov. Du vælger under Support (/settings/support), hvilke data Support må se, og i hvilken periode.
- Chatbotten kan ikke se dine data, og samtaler med den gemmes, så Support kan forbedre hjælpen.

## Integrationer
- Under Integrationer (/settings/integrations) ser du, hvilke apps og enheder du kan forbinde, fx Apple Health, Health Connect, Withings, Google Health, Fitbit og Strava.

## Familie
- Med Seriøs Familie kan du invitere familiemedlemmer og oprette børneprofiler under Familie (/profile/family).

## Fejl i appen
- Fejl i en vares data: swipe på registreringen og vælg at melde fejl.
- Andre fejl i appen: Meld en fejl (/profile/report-bug).

## Kontakt
- Hello Cal har ingen telefonsupport.
- Fandt brugeren ikke svaret, kan de skrive til Support via Kontakt os (/settings/support/contact) eller trykke "Tal med en medarbejder" i chatten. Support svarer i appen.
`.trim();

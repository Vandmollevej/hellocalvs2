// "Page tree" i admin (docs/DECISIONS.md 2026-09-27): håndholdt kort over
// samtlige sider i appen, grupperet efter hvor man kommer ind på dem. Hver
// `page.tsx` under src/app skal stå her præcis én gang — page-tree.test.mjs
// fejler, hvis en ny side mangler, så kortet ikke stille bliver forældet.

export type PageNode = {
  path: string;
  label: string;
  note?: string;
  children?: PageNode[];
};

export type PageArea = {
  id: string;
  title: string;
  description: string;
  pages: PageNode[];
};

export const PAGE_TREE: PageArea[] = [
  {
    id: "onboarding",
    title: "Velkomst & login",
    description: "Det en ny eller udlogget bruger møder, før appen åbner.",
    pages: [
      {
        path: "/welcome",
        label: "Velkomst",
        children: [
          {
            path: "/signup",
            label: "Opret bruger",
            children: [
              { path: "/verify-email", label: "Bekræft e-mail" },
            ],
          },
          {
            path: "/login",
            label: "Log ind",
            children: [
              { path: "/login/country", label: "Vælg land" },
              { path: "/login/face-id", label: "Face ID" },
              { path: "/account/phone", label: "Telefonnummer", note: "Obligatorisk; vises efter login, hvis kontoen mangler nummer (tofaktor)" },
              {
                path: "/family-code",
                label: "Familiekode",
                children: [
                  { path: "/family-code/scan", label: "Scan QR-kode", note: "Scan familiens QR-kode i appen" },
                  { path: "/family-code/join", label: "Tilknyt familie", note: "Åbnes af en scannet familie-QR-kode; kræver login med kodens e-mail" },
                ],
              },
              {
                path: "/forgot-password",
                label: "Glemt adgangskode",
                children: [{ path: "/reset-password", label: "Nulstil adgangskode", note: "Åbnes fra link i mail" }],
              },
            ],
          },
        ],
      },
      { path: "/business", label: "Business-partnere", note: "Offentlig, fra forsidens footer (udlogget)" },
      { path: "/presse", label: "Presse", note: "Offentlig, fra forsidens footer (udlogget)" },
      { path: "/om-os", label: "Om Hello Cal", note: "Offentlig, ikke indekseret" },
      {
        path: "/partner",
        label: "Partnerportal (B2B)",
        note: "Eget login for partneres B2B-brugere; kontoen oprettes kun af en administrator",
        children: [
          { path: "/partner/login", label: "Log ind (B2B)" },
          { path: "/partner/verify", label: "2-faktor-kode", note: "Efter adgangskode" },
          { path: "/partner/invite/[token]", label: "Accepter invitation", note: "Åbnes fra link i mail; adgangskode + 2-faktor (QR-kode)" },
        ],
      },
    ],
  },
  {
    id: "main",
    title: "Forside & bundmenu",
    description: "Forsiden og alle faner i bundmenuen.",
    pages: [
      {
        path: "/",
        label: "Forside (dagens liste)",
        children: [
          {
            path: "/add/menu",
            label: "Tilføj-menu (+)",
            children: [
              { path: "/weight/create", label: "Registrér vægt" },
              { path: "/weigh-reminders", label: "Vejepåmindelser", note: "Åbnes fra fredags-flowet" },
              { path: "/water/create", label: "Registrér vand" },
              { path: "/drinks", label: "Drinks", children: [{ path: "/drinks/[id]", label: "Tilføj drink" }] },
              { path: "/activity/create", label: "Tilføj aktivitet" },
              { path: "/period/create", label: "Registrér menstruation" },
              {
                path: "/add/[id]",
                label: "Tilføj madvare",
                children: [
                  { path: "/add/[id]/photo-award", label: "Foto-belønning" },
                  { path: "/add/[id]/update", label: "Opdater varen", note: "Fra banneret på varesiden: foto af manglende front/næring/ingredienser giver points" },
                ],
              },
            ],
          },
          {
            path: "/registration/[id]",
            label: "Registrering",
            note: "Tryk på en linje i dagens liste",
            children: [{ path: "/registration/[id]/report-error", label: "Rapportér fejl" }],
          },
          {
            path: "/foods",
            label: "Madvarer",
            children: [
              { path: "/foods/new", label: "Ny madvare (omdirigerer til scanning)" },
              { path: "/product/create", label: "Opret vare" },
              { path: "/create-dish", label: "Opret ret" },
            ],
          },
          { path: "/calendar", label: "Kalender" },
          {
            path: "/statistics",
            label: "Statistik",
            children: [
              { path: "/statistics/month-sinners", label: "Månedens synder", note: "Fra kalenderens månedsvisning; slået fra (SINNERS_ENABLED)" },
              { path: "/statistics/sleep", label: "Søvnstatistik", note: "Fra Statistik i kalenderens søvnbjælke" },
              { path: "/statistics/body-water", label: "Væske", note: "Kropsvand (%) pr. dag mod kalorier, salt og sukker" },
              { path: "/statistics/unused-cards", label: "Ubrugte kort" },
              { path: "/statistics/unused-charts", label: "Ubrugte grafer" },
            ],
          },
          {
            path: "/camera",
            label: "Kamera",
            children: [{ path: "/camera/create", label: "Opret fra billede" }],
          },
          { path: "/search", label: "Søg" },
          { path: "/my-scans", label: "Dine indscanninger" },
          { path: "/favorites", label: "Favoritter" },
          { path: "/voice", label: "Stemme" },
          { path: "/chat", label: "Indtast", note: "Desktop: beskriv maden med tekst i stedet for stemme" },
          { path: "/widgets", label: "Widgets", note: "Designforhåndsvisning af native widgets; ikke linket fra menuerne" },
        ],
      },
    ],
  },
  {
    id: "profile",
    title: "Profil",
    description: "Profil-fanen i bundmenuen og alt derunder.",
    pages: [
      {
        path: "/profile",
        label: "Profil",
        children: [
          {
            path: "/profile/edit",
            label: "Redigér profil",
            children: [
              { path: "/profile/change-password", label: "Skift adgangskode" },
              {
                path: "/profile/start-weight",
                label: "Startvægt",
                children: [{ path: "/profile/start-weight/verify", label: "Bekræft startvægt" }],
              },
              { path: "/profile/height", label: "Højde (låst)" },
              { path: "/profile/target-weight", label: "Målvægt" },
            ],
          },
          {
            path: "/profile/subscription",
            label: "Abonnement",
            children: [
              { path: "/profile/subscription/[plan]", label: "Vælg plan" },
              { path: "/profile/subscription/redeem-points", label: "Indløs point" },
            ],
          },
          {
            path: "/profile/goals",
            label: "Mål",
            children: [
              { path: "/profile/goals/new", label: "Nyt mål" },
              { path: "/profile/goals/upcoming", label: "Kommende målsætninger", note: "Desktop: dropdown på Målsætning — sender derhen" },
              {
                path: "/profile/goals/[id]",
                label: "Målsætning",
                children: [{ path: "/profile/goals/[id]/edit", label: "Redigér målsætning" }],
              },
            ],
          },
          { path: "/profile/energy-goal", label: "Kaloriemål", note: "Energibehov → budget; desktop: dropdown på Målsætning" },
          { path: "/profile/weight-calibration", label: "Vægtkalibrering" },
          { path: "/profile/body-measurements", label: "Kropsmål" },
          { path: "/profile/sleep", label: "Søvn" },
          {
            path: "/profile/screenings",
            label: "Screeninger",
            children: [
              { path: "/profile/screenings/new", label: "Opret ny screening" },
              { path: "/profile/screenings/[id]", label: "Redigér screening" },
              {
                path: "/profile/screenings/reports",
                label: "Screeningrapporter",
                children: [{ path: "/profile/screenings/reports/[id]", label: "Rapport", note: "Målingerne for én screening" }],
              },
            ],
          },
          { path: "/profile/photo-diary", label: "Fotodagbog" },
          { path: "/profile/status", label: "Status" },
          { path: "/profile/points", label: "Point" },
          {
            path: "/profile/recipes",
            label: "Opskrifter",
            children: [
              { path: "/profile/recipes/filters", label: "Filtre" },
              { path: "/profile/recipes/[id]", label: "Opskrift" },
              { path: "/profile/recipes/hellofresh/[id]", label: "HelloFresh-opskrift", note: "Vist som i HelloFresh-appen" },
            ],
          },
          { path: "/profile/family", label: "Familie" },
          { path: "/profile/invite", label: "Invitér" },
          { path: "/profile/messages", label: "Beskeder" },
          { path: "/profile/messages/trash", label: "Papirkurv" },
          {
            path: "/viden-om",
            label: "Viden om mad",
            children: [
              { path: "/viden-om/e-numre", label: "E-numre", note: "Blok-liste; hver række åbner /e-numre/[code]" },
              { path: "/viden-om/omregning", label: "Omregning: væsker til gram" },
              {
                path: "/viden-om/[category]",
                label: "Kategori",
                note: "Vitaminer, sundhedstips, kalorieforbrænding, WHO, Mad på latin",
                children: [{ path: "/viden-om/[category]/[slug]", label: "Artikel / ord" }],
              },
              {
                path: "/e-numre",
                label: "E-numre (oversigt)",
                children: [{ path: "/e-numre/[code]", label: "E-nummer", note: "Beskrivelse, sundhed og kilder for ét stof" }],
              },
              { path: "/vitaminer", label: "Vitaminer og mineraler", note: "Ét anker pr. næringsstof; varesidens \"Vis mere\" linker hertil" },
              { path: "/mad-paa-latin", label: "Mad på latin", note: "Ordbog over ikke-danske ingrediensnavne" },
            ],
          },
          { path: "/profile/notifications", label: "Notifikationer" },
          { path: "/profile/login-approval", label: "Godkend login med notifikation", note: "Slå til på denne enhed" },
          { path: "/profile/report-bug", label: "Rapportér fejl" },
        ],
      },
    ],
  },
  {
    id: "settings",
    title: "Indstillinger",
    description: "Tandhjulet øverst til højre på skærmene.",
    pages: [
      {
        path: "/settings",
        label: "Indstillinger",
        children: [
          {
            path: "/profile/settings",
            label: "Profilindstillinger",
            children: [
              { path: "/profile/settings/language-region", label: "Sprog og region" },
              { path: "/profile/settings/results", label: "Resultater" },
            ],
          },
          {
            path: "/settings/payment",
            label: "Betaling",
            children: [
              { path: "/settings/payment/mobilepay", label: "MobilePay" },
              { path: "/settings/payment/stripe", label: "Stripe-retur", note: "Stripe Checkout sender tilbage hertil" },
            ],
          },
          { path: "/settings/delete-permissions", label: "Sletterettigheder" },
          { path: "/settings/control-log", label: "Kontrollog" },
          {
            path: "/settings/integrations",
            label: "Integrationer",
            children: [
              { path: "/settings/integrations/[app]", label: "Integration" },
              { path: "/settings/import", label: "Flyt fra MyFitnessPal / Lifesum" },
            ],
          },
          {
            path: "/settings/hello-doc",
            label: "Hello Doc",
            children: [
              { path: "/settings/hello-doc/invite", label: "Invitér behandler" },
              { path: "/settings/hello-doc/preview", label: "Forhåndsvisning" },
              { path: "/settings/hello-doc/[id]", label: "Deling" },
            ],
          },
          {
            path: "/settings/support",
            label: "Support",
            children: [
              { path: "/settings/support/contact", label: "Kontakt support" },
              {
                path: "/settings/support/requests",
                label: "Mine henvendelser",
                children: [{ path: "/settings/support/requests/[id]", label: "Henvendelse" }],
              },
            ],
          },
          {
            path: "/settings/display",
            label: "Visning",
            children: [
              { path: "/settings/display/front-page", label: "Visning: forside" },
              { path: "/settings/display/limits", label: "Visning: grænser" },
              { path: "/settings/display/uncertainty", label: "Visning: usikkerhed" },
              { path: "/settings/display/calendar-view", label: "Visning: kalender" },
              { path: "/settings/display/sleep-quality", label: "Visning: oplevet søvnkvalitet" },
              { path: "/settings/display/tips", label: "Visning: tips og hjælpetekster" },
              { path: "/settings/display/menstrual-cycle", label: "Visning: menstruationscyklus" },
              { path: "/settings/display/body-measurements", label: "Visning: kropsmål", note: "Hvilke kropsmål Kropsmål-siden viser" },
            ],
          },
          { path: "/betingelser", label: "Betingelser" },
          { path: "/privatlivspolitik", label: "Privatlivspolitik" },
        ],
      },
    ],
  },
  {
    id: "links",
    title: "Åbnes fra links",
    description: "Sider man kun når via et link i en mail eller en delt adresse.",
    pages: [
      { path: "/hello-doc/[token]", label: "Hello Doc (behandlerens visning)" },
      { path: "/forward/[token]", label: "Videresendt vare" },
      { path: "/approve-login", label: "Godkend login", note: "Fra push-notifikation på en enhed, der allerede er logget ind" },
    ],
  },
  {
    id: "scan",
    title: "Oprettelses-app (scan)",
    description: "Den separate app til at oprette varer i butikken.",
    pages: [
      {
        path: "/scan/login",
        label: "Log ind",
        children: [{ path: "/scan/verify", label: "Bekræft kode" }],
      },
      { path: "/scan/setup/[token]", label: "Opsætning fra invitation" },
      {
        path: "/scan/menu",
        label: "Menu",
        children: [
          { path: "/scan", label: "Billede af hylde" },
          { path: "/scan/opret", label: "Opret vare" },
          { path: "/scan/historik", label: "Historik" },
          { path: "/scan/ikke-afregnet", label: "Ikke afregnet" },
          { path: "/scan/bank", label: "Bank" },
          { path: "/scan/beskeder", label: "Beskeder" },
          { path: "/scan/profil", label: "Profil" },
        ],
      },
    ],
  },
  {
    id: "admin",
    title: "Admin",
    description: "Administrationen — menuen øverst på admin-siderne.",
    pages: [
      {
        path: "/admin/login",
        label: "Log ind",
        children: [
          { path: "/admin/verify", label: "Bekræft" },
          { path: "/admin/setup", label: "Første opsætning" },
          { path: "/admin/approve/[token]", label: "Godkend login", note: "Åbnes fra link i mail" },
          { path: "/admin/login-approval/wait", label: "Godkend dette udstyr", note: "Ny enhed venter på godkendelse via mail (op til 15 min.)" },
          { path: "/admin/login-approval/[token]", label: "Godkend ny enhed", note: "Login-frit link fra godkendelses-mailen" },
          { path: "/admin/invite/[token]", label: "Accepter admin-invitation", note: "Login-frit tilmeldingslink; gælder 24 timer" },
          {
            path: "/admin/forgot-password",
            label: "Glemt adgangskode",
            children: [{ path: "/admin/reset-password", label: "Nulstil adgangskode", note: "Åbnes fra link i mail" }],
          },
        ],
      },
      {
        path: "/admin",
        label: "Oversigt",
        children: [
          {
            path: "/admin/products",
            label: "Nye varer",
            children: [{ path: "/admin/products/[id]", label: "Vare" }],
          },
          {
            path: "/admin/users",
            label: "Brugere",
            children: [
              { path: "/admin/users/personas", label: "Personas" },
              { path: "/admin/users/points", label: "Tildel points", note: "Points som kompensation: højst 300 ad gangen, én gang om måneden" },
            ],
          },
          { path: "/admin/admin-users", label: "Admin-brugere", note: "Via profil-ikonet øverst: adgang, invitationer, 2-faktor, IP-begrænsning og login-log" },
          { path: "/admin/test-programmes", label: "Test-programmes" },
          { path: "/admin/economy", label: "Economy", note: "Betalende abonnementer, sikret indkomst og forventet indtjening" },
          {
            path: "/admin/chatbot",
            label: "Chatbot",
            note: "Oftest spurgt, alle spørgsmål og svar",
            children: [{ path: "/admin/chatbot/[id]", label: "Chatbot-samtale" }],
          },
          {
            path: "/admin/support",
            label: "Support",
            children: [
              { path: "/admin/support/templates", label: "Svarskabeloner" },
              { path: "/admin/support/[id]", label: "Supportsag" },
            ],
          },
          { path: "/admin/bug-reports", label: "Fejlrapporter" },
          {
            path: "/admin/messaging",
            label: "Besked automatisering",
            children: [
              { path: "/admin/messaging/[event]", label: "Rediger mail/notifikation" },
              { path: "/admin/messaging/kladde", label: "Kladde", note: "Sandkasse til nye beskeder" },
            ],
          },
          {
            path: "/admin/images",
            label: "Billedbehandling",
            children: [{ path: "/admin/images/cutout-queue", label: "Billeder i kø til frilæggelse" }],
          },
          {
            path: "/admin/quality-control",
            label: "Kvalitetskontrol",
            children: [
              { path: "/admin/quality-control/shared-recipes", label: "Delte retter" },
              { path: "/admin/quality-control/activities", label: "Aktiviteter" },
            ],
          },
          { path: "/admin/activities", label: "Aktiviteter" },
          { path: "/admin/ingredient-requests", label: "Ønskede ingredienser" },
          {
            path: "/admin/dishes",
            label: "Retter",
            note: "Sender videre til Brugeroprettede retter",
            children: [
              { path: "/admin/dishes/user", label: "Brugeroprettede retter" },
              {
                path: "/admin/dishes/hellofresh",
                label: "HelloFresh-retter",
                children: [{ path: "/admin/dishes/hellofresh/[id]", label: "HelloFresh-ret", note: "Kun visning" }],
              },
              {
                path: "/admin/dishes/retnemt",
                label: "RetNemt-retter",
                children: [{ path: "/admin/dishes/retnemt/[id]", label: "RetNemt-ret", note: "Kun visning" }],
              },
              {
                path: "/admin/dishes/betterfeast",
                label: "BetterFeast-retter",
                children: [{ path: "/admin/dishes/betterfeast/[id]", label: "BetterFeast-ret", note: "Kun visning" }],
              },
              { path: "/admin/dishes/valdemarsro", label: "Valdemarsro-retter" },
            ],
          },
          {
            path: "/admin/uncertainties",
            label: "Usikkerheder",
            children: [{ path: "/admin/warnings", label: "Advarsler", note: "Gammel adresse — sender videre" }],
          },
          { path: "/admin/cron-jobs", label: "Cron-jobs" },
          { path: "/admin/pet-food-filter", label: "Dyrefoder-filter", note: "Se og redigér filteret, der afviser dyrefoder; afprøv varer og stregkoder" },
          { path: "/admin/log", label: "Log", note: "Test-log indtil go-live: scanninger trin for trin, AI-kald, cron, fejl" },
          { path: "/admin/duplicate-products", label: "Dubletter" },
          {
            path: "/admin/product-database",
            label: "Varedatabase",
            note: "Sender videre til Varer",
            children: [
              { path: "/admin/product-database/products", label: "Varer" },
              { path: "/admin/product-database/brands", label: "Brands" },
              {
                path: "/admin/product-database/images",
                label: "Billeder",
                note: "Træk produktbilleder (EAN/produkttype) og brand-logoer (filnavn = brand) ind, to kolonner",
                children: [
                  { path: "/admin/product-database/image-upload", label: "Billed-upload", note: "Gammel adresse — sender videre til Billeder" },
                  { path: "/admin/product-database/logo-upload", label: "Logo-upload", note: "Gammel adresse — sender videre til Billeder" },
                ],
              },
            ],
          },
          { path: "/admin/search", label: "Søg", note: "Gammel adresse — sender videre til Varer" },
          { path: "/admin/search-ranking", label: "Søgealgoritmer" },
          { path: "/admin/search-synonyms", label: "Synonymordbog" },
          { path: "/admin/weight-attire", label: "Vejning: tøj-algoritme" },
          { path: "/admin/passkeys", label: "Passkeys" },
          { path: "/admin/shortcuts", label: "Genveje", note: "Tastaturgenvej til hvert menupunkt + AutoHotkey-tekst" },
          {
            path: "/admin/scan-invites",
            label: "scan-invites",
            children: [
              { path: "/admin/scan-invites/[id]", label: "Agent" },
              { path: "/admin/scan-invites/afvisningsaarsager", label: "Afvisningsårsager" },
            ],
          },
          { path: "/admin/logos", label: "Logoer" },
          { path: "/admin/api-keys", label: "API-nøgler" },
          {
            path: "/admin/designmanual",
            label: "Designmanual",
            children: [{ path: "/admin/designmanual/skitser", label: "Skitser i pixels", note: "Inspirationsbilleder tegnet som opsætningskasser med pixelmål" }],
          },
          { path: "/admin/guide-builder", label: "Guide-builder", note: "Startup-guide og tooltips" },
          { path: "/admin/hello-doc", label: "Hello Doc", note: "Lægevisningen med administratorens egen konto som data" },
          { path: "/admin/page-tree", label: "Sidetræ", note: "Denne side" },
          {
            path: "/admin/flows",
            label: "Flows",
            children: [{ path: "/admin/flows/[id]", label: "Flow" }],
          },
          {
            path: "/admin/partners",
            label: "Partnere",
            children: [
              { path: "/admin/partners/contacts", label: "Kontakter", note: "Partnerliste og kontaktpersoner" },
              { path: "/admin/partners/ads", label: "Reklamer", note: "Lokationer med visninger og klik" },
              { path: "/admin/partners/reports", label: "Rapporter", note: "Send rapporter til partneres kontakter" },
              { path: "/admin/partners/users", label: "B2B-brugere", note: "Login til partnerportalen for partnerens egne folk" },
              { path: "/admin/partners/[id]", label: "Partner: Sponsoraftale", note: "Venstre bjælke med virksomhed og kontakter, uden søgefelt" },
              { path: "/admin/partners/[id]/performance", label: "Partner: Performance", note: "Faner Overview og Data mining, PDF/CSV, send rapport" },
              { path: "/admin/partners/[id]/billing", label: "Partner: Faktureringsdetaljer" },
              { path: "/admin/partners/[id]/payment", label: "Partner: Betalingsmetode" },
            ],
          },
          {
            path: "/admin/integrations",
            label: "Integrationer",
            note: "Installationer, brug og frakoblinger pr. integration",
            children: [{ path: "/admin/integrations/[slug]", label: "Integration" }],
          },
          {
            path: "/admin/statistics",
            label: "Statistik",
            note: "Dashboards med filtre; fanen Trafik (?view=traffic) er besøgsstatistik fra Umami",
            children: [
              { path: "/admin/analytics", label: "Analyse", note: "Gammel adresse — sender videre til Statistik: Trafik" },
              {
                path: "/admin/statistics/search",
                label: "Søgning",
                note: "Søgestatistik: alle søgninger, raffinerede søgninger og søgninger uden resultat (rene fejl)",
              },
            ],
          },
          { path: "/admin/jobs", label: "Jobs", note: "Jobs sat op af AI-agenter (åbne/afsluttede)" },
          { path: "/admin/agents", label: "Agenter", note: "AI-agenter med MCP-adgang" },
          { path: "/admin/robots", label: "Robotter", note: "On/off, KØR og cron-plan for robot-containerne" },
          { path: "/admin/roadmap", label: "Roadmap" },
          { path: "/admin/claude", label: "Claude-integration", note: "Vejledning til MCP-forbindelsen" },
        ],
      },
    ],
  },
];

// Dynamiske sider ([id], [token] …) kan ikke åbnes direkte uden et rigtigt id.
export function isDynamicPath(path: string): boolean {
  return path.includes("[");
}

export function flattenPageTree(areas: PageArea[] = PAGE_TREE): PageNode[] {
  const result: PageNode[] = [];
  const walk = (nodes: PageNode[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children) walk(node.children);
    }
  };
  for (const area of areas) walk(area.pages);
  return result;
}

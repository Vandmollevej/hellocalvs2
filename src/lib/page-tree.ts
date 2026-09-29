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
              { path: "/family-code", label: "Familiekode" },
              {
                path: "/forgot-password",
                label: "Glemt adgangskode",
                children: [{ path: "/reset-password", label: "Nulstil adgangskode", note: "Åbnes fra link i mail" }],
              },
            ],
          },
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
              { path: "/water/create", label: "Registrér vand" },
              { path: "/activity/create", label: "Tilføj aktivitet" },
              { path: "/period/create", label: "Registrér menstruation" },
              {
                path: "/add/[id]",
                label: "Tilføj madvare",
                children: [{ path: "/add/[id]/photo-award", label: "Foto-belønning" }],
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
              { path: "/foods/new", label: "Ny madvare" },
              { path: "/product/create", label: "Opret vare" },
              { path: "/create-dish", label: "Opret ret" },
              {
                path: "/ingredients",
                label: "Ingredienser",
                children: [{ path: "/ingredients/new", label: "Ny ingrediens" }],
              },
            ],
          },
          { path: "/calendar", label: "Kalender" },
          {
            path: "/statistics",
            label: "Statistik",
            children: [
              // "Månedens synder" slået fra (SINNERS_ENABLED).
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
          { path: "/voice", label: "Stemme" },
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
              { path: "/profile/goals/[id]", label: "Redigér mål" },
            ],
          },
          { path: "/profile/weight-calibration", label: "Vægtkalibrering" },
          { path: "/profile/body-measurements", label: "Kropsmål" },
          { path: "/profile/sleep", label: "Søvn" },
          { path: "/profile/photo-diary", label: "Fotodagbog" },
          { path: "/profile/points", label: "Point" },
          {
            path: "/profile/recipes",
            label: "Opskrifter",
            children: [
              { path: "/profile/recipes/filters", label: "Filtre" },
              { path: "/profile/recipes/[id]", label: "Opskrift" },
            ],
          },
          { path: "/profile/family", label: "Familie" },
          { path: "/profile/invite", label: "Invitér" },
          { path: "/profile/messages", label: "Beskeder" },
          { path: "/profile/notifications", label: "Notifikationer" },
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
            children: [{ path: "/settings/payment/mobilepay", label: "MobilePay" }],
          },
          { path: "/settings/delete-permissions", label: "Sletterettigheder" },
          { path: "/settings/control-log", label: "Kontrollog" },
          {
            path: "/settings/integrations",
            label: "Integrationer",
            children: [{ path: "/settings/integrations/[app]", label: "Integration" }],
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
          { path: "/settings/display/front-page", label: "Visning: forside" },
          { path: "/settings/display/limits", label: "Visning: grænser" },
          { path: "/settings/display/uncertainty", label: "Visning: usikkerhed" },
          { path: "/settings/display/calendar-view", label: "Visning: kalender" },
          { path: "/settings/display/sleep-quality", label: "Visning: oplevet søvnkvalitet" },
          { path: "/settings/display/menstrual-cycle", label: "Visning: menstruationscyklus" },
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
          { path: "/admin/users", label: "Brugere" },
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
            children: [{ path: "/admin/messaging/[event]", label: "Rediger mail/notifikation" }],
          },
          { path: "/admin/images", label: "Billedforslag" },
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
            path: "/admin/uncertainties",
            label: "Usikkerheder",
            children: [{ path: "/admin/warnings", label: "Advarsler", note: "Gammel adresse — sender videre" }],
          },
          { path: "/admin/cron-jobs", label: "Cron-jobs" },
          { path: "/admin/log", label: "Log", note: "Test-log indtil go-live: scanninger trin for trin, AI-kald, cron, fejl" },
          { path: "/admin/duplicate-products", label: "Dubletter" },
          {
            path: "/admin/product-database",
            label: "Varedatabase",
            note: "Sender videre til Varer",
            children: [
              { path: "/admin/product-database/products", label: "Varer" },
              { path: "/admin/product-database/brands", label: "Brands" },
            ],
          },
          { path: "/admin/search", label: "Søg", note: "Gammel adresse — sender videre til Varer" },
          { path: "/admin/search-ranking", label: "Søgealgoritmer" },
          { path: "/admin/passkeys", label: "Passkeys" },
          {
            path: "/admin/scan-invites",
            label: "scan-invites",
            children: [{ path: "/admin/scan-invites/[id]", label: "Invitation" }],
          },
          { path: "/admin/logos", label: "Logoer" },
          { path: "/admin/api-keys", label: "API-nøgler" },
          { path: "/admin/designmanual", label: "Designmanual" },
          { path: "/admin/page-tree", label: "Sidetræ", note: "Denne side" },
          {
            path: "/admin/flows",
            label: "Flows",
            children: [{ path: "/admin/flows/[id]", label: "Flow" }],
          },
          { path: "/admin/partners", label: "Partnere" },
          { path: "/admin/statistics?view=traffic", label: "Statistik: Trafik", note: "Besøgsstatistik fra Umami (tidl. Analyse)" },
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
